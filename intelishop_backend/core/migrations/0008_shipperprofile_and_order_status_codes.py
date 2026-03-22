from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0007_storereview'),
    ]

    operations = [
        migrations.CreateModel(
            name='ShipperProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('company_name', models.CharField(max_length=150)),
                ('contact_email', models.EmailField(blank=True, max_length=255)),
                ('phone_number', models.CharField(blank=True, max_length=20)),
                ('is_active', models.BooleanField(db_index=True, default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='shipper_profile', to='core.user')),
            ],
            options={
                'ordering': ['-updated_at'],
            },
        ),
        migrations.AlterField(
            model_name='order',
            name='status',
            field=models.CharField(choices=[('PENDING', 'Cho vendor xac nhan'), ('READY_FOR_PICKUP', 'Cho shipper nhan don'), ('DELIVERING', 'Dang giao'), ('DELIVERED', 'Da giao'), ('FAILED', 'Giao that bai')], db_index=True, default='PENDING', max_length=32, verbose_name='Tình trạng'),
        ),
        migrations.AddField(
            model_name='shipperapplication',
            name='business_license',
            field=models.FileField(blank=True, null=True, upload_to='shipper_applications/%Y/%m/', verbose_name='Giấy phép kinh doanh'),
        ),
    ]


