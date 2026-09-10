# Implementation Plan: Tournament Management System

## 1. Backend Model Changes

### `accounts/models.py`
- **`Profile` Model**:
    - Add `role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='parent')`
    - `ROLE_CHOICES = [('trainer', 'Trainer'), ('parent', 'Parent'), ('secretary', 'Secretary'), ('admin', 'Admin')]`

### `tournament/models.py`
- **`Athlete` Model**:
    - Add `trainer = models.ForeignKey('accounts.Profile', on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_athletes')`
- **`Tournament` Model**:
    - Add `start_time = models.TimeField(null=True, blank=True)`
- **`Match` Model**:
    - Add `scheduled_time = models.DateTimeField(null=True, blank=True)`
    - Add `duration = models.PositiveIntegerField(default=3, help_text="Duration in minutes")`
- **New `TournamentRegistration` Model**:
    - `tournament = ForeignKey(Tournament)`
    - `athlete = ForeignKey(Athlete)`
    - `registered_at = DateTimeField(auto_now_add=True)`
    - `status = CharField(choices=[('confirmed', 'Confirmed'), ('pending', 'Pending')])`

## 2. Automation Logic

### A. Automatic Category Generation
**File**: `tournament/services.py` (New file)
- **Method**: `generate_categories(tournament_id)`
- **Logic**:
    1. Fetch all `TournamentRegistration` for the tournament.
    2. Group athletes by `gender`.
    3. For each gender, analyze weight distribution.
    4. Create `TournamentCategory` entries based on predefined weight brackets (e.g., < 50kg, 50-60kg, etc.) or dynamic clusters if templates are missing.
    5. Assign athletes to the corresponding `TournamentCategory`.

### B. Automatic Single-Elimination Bracket Generation
**File**: `tournament/services.py`
- **Method**: `generate_bracket(category_id)`
- **Algorithm**:
    1. Get athletes in `TournamentCategory`.
    2. Calculate $N$ as the smallest power of 2 $\ge$ number of athletes.
    3. Byes count: $Byes = N - \text{athletes}$.
    4. Initialize `Round` objects (e.g., "1/8", "1/4", "Semi-Final", "Final").
    5. Create $N/2$ matches in the first round.
    6. Populate matches:
        - Randomly assign athletes to slots.
        - Assign "Bye" to remaining slots. Matches with a Bye automatically promote the remaining athlete.
    7. Chain matches using `previous_match1` and `previous_match2` for subsequent rounds.

### C. Automatic Winner Promotion
**File**: `tournament/models.py` or `tournament/services.py`
- **Method**: `promote_winner(match_id, winner_id)`
- **Logic**:
    1. Update `Match.winner = winner_id` and `Match.status = STATUS_FINISHED`.
    2. Find `next_match` where `previous_match1 == match` or `previous_match2 == match`.
    3. If `previous_match1`, set `next_match.athlete1 = winner_id`.
    4. If `previous_match2`, set `next_match.athlete2 = winner_id`.

## 3. API Endpoints

| Endpoint | Method | Description | Role |
|---|---|---|---|
| `/api/tournaments/{id}/register/` | POST | Register athlete for tournament | Trainer/Parent |
| `/api/tournaments/{id}/automate-categories/` | POST | Trigger category generation | Secretary/Admin |
| `/api/tournaments/{id}/automate-brackets/` | POST | Trigger bracket generation | Secretary/Admin |
| `/api/accounts/bind-child/` | POST | Bind parent user to athlete | Parent/Admin |
| `/api/matches/{id}/promote/` | PATCH | One-click winner promotion | Secretary/Admin |
| `/api/tournaments/{id}/status/` | GET | Real-time status for parent dashboard | Parent |

## 4. Frontend Architecture

### A. Trainer Cabinet (`/cabinet/trainer`)
- **Layout**: Sidebar navigation (Athletes, Tournaments, My Matches).
- **Components**:
    - `AthleteList`: Management of athletes (edit weight, birth date).
    - `RegistrationForm`: Select tournament $\to$ select athletes $\to$ submit.
    - `TournamentProgress`: View generated brackets for their athletes.

### B. Parent Cabinet (`/cabinet/parent`)
- **Layout**: Focused dashboard centered on the child.
- **Components**:
    - `ChildTracker`: Big card showing: "Current Status: [Waiting / In Progress / Finished]", "Mat: [X]", "Round: [Y]".
    - `MatchTimeline`: List of matches the child participated in.

### C. Secretary Multi-Mat Panel (`/admin/tournaments/{slug}/manage`)
- **Layout**: Responsive grid of "Mat Cards".
- **Components**:
    - `MatCard`: 
        - Header: Mat Name/Number.
        - Body: Current Match (Athlete 1 vs Athlete 2), Timer, Status.
        - Footer: "Promote Winner" dropdown/buttons.
    - `BracketOverview`: High-level view of all categories.

## 5. Design Specs

- **Colors**: 
    - Backgrounds: `#FFFFFF` or `--color-light-gray`.
    - Primary Actions: `--color-primary-blue` (`#184F9E`).
    - Dark Accents: `--color-dark-blue` (`#081A35`).
- **Typography**: Inter font, bold headings, secondary text in `--color-secondary-text`.
- **Components**:
    - Use `rounded-xl` for all cards and buttons.
    - Animation: Use `framer-motion` for "Mat Card" status updates (fade-in/out).
    - Layout: Tailwind `grid` for Mat Panel, `flex` for cabinet navigation.

## 6. Verification Plan

### Scenario 1: Trainer Registration Flow
1. Login as Trainer $\to$ Create/Select Athlete.
2. Navigate to Tournament $\to$ Register Athlete.
3. Verify `TournamentRegistration` created in DB.

### Scenario 2: Secretary Automation Flow
1. Login as Secretary $\to$ Tournament Admin.
2. Trigger `automate-categories` $\to$ Verify athletes are grouped correctly.
3. Trigger `automate-brackets` $\to$ Verify matches are created with byes handled.
4. Mark Match 1 winner $\to$ Verify winner is moved to Match 5 (next round).

### Scenario 3: Parent Real-time Tracking
1. Login as Parent $\to$ Bind to Child Athlete.
2. Open Dashboard.
3. Secretary marks Match as "In Progress" on Mat 2.
4. Verify Parent Dashboard updates to "In Progress - Mat 2" via polling or WebSocket.
