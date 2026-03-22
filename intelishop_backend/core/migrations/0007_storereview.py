from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_product_description_product_is_deleted_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='StoreReview',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('rating', models.PositiveSmallIntegerField()),
                ('comment', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('store', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reviews', to='core.store')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='store_reviews', to='core.user')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='storereview',
            constraint=models.UniqueConstraint(fields=('store', 'user'), name='unique_store_review_per_user'),
        ),
    ]

