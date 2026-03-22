from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_store_business_category_store_is_active_store_owner_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmailOTPChallenge',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(db_index=True, max_length=254)),
                ('purpose', models.CharField(choices=[('register_activation', 'Kich hoat tai khoan'), ('reset_password', 'Dat lai mat khau')], db_index=True, max_length=32)),
                ('otp_code', models.CharField(max_length=10)),
                ('expires_at', models.DateTimeField(db_index=True)),
                ('is_used', models.BooleanField(db_index=True, default=False)),
                ('attempts', models.PositiveSmallIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='otp_challenges', to='core.user')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='emailotpchallenge',
            index=models.Index(fields=['email', 'purpose', 'is_used'], name='core_emailot_email_c22843_idx'),
        ),
    ]

