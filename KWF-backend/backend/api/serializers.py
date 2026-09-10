from rest_framework import serializers
from .models import News


class NewsSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(required=False)

    class Meta:
        model = News
        fields = [
            'id',
            'title',
            'slug',
            'description',
            'image',
            'is_published',
            'created_at',
            'updated_at',
            'published_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'published_at']

    def create(self, validated_data):
        return News.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
