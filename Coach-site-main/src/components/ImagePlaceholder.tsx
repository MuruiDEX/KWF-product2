interface ImagePlaceholderProps {
  label: string
  aspect?: string
}

export default function ImagePlaceholder({ label, aspect = "aspect-[4/5]" }: ImagePlaceholderProps) {
  return (
    <div className={`${aspect} w-full rounded-3xl overflow-hidden bg-light-gray shadow-xl`}>
      <div className="w-full h-full bg-gradient-to-br from-light-gray via-white to-border flex items-center justify-center relative">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="w-full h-full" style={{
            backgroundImage: `radial-gradient(circle at 30% 40%, #17488F 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} />
        </div>
        <div className="text-center relative z-10">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-dark-blue/5 border border-dark-blue/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-dark-blue/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-secondary-text">{label}</p>
          <p className="text-xs text-secondary-text mt-0.5">Загрузите фото</p>
        </div>
      </div>
    </div>
  )
}
