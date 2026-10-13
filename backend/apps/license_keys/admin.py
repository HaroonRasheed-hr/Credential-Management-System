from django.contrib import admin

from apps.license_keys.models import LicenseKey


@admin.register(LicenseKey)
class LicenseKeyAdmin(admin.ModelAdmin):
    list_display = ['license_name', 'vendor', 'expiry_date', 'project', 'updated_by', 'updated_at']
    list_filter = ['vendor']
    search_fields = ['license_name', 'vendor', 'project__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
