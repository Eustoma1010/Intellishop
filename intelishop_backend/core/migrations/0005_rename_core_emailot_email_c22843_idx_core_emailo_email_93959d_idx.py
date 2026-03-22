from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_emailotpchallenge'),
    ]

    operations = [
        migrations.RenameIndex(
            model_name='emailotpchallenge',
            new_name='core_emailo_email_93959d_idx',
            old_name='core_emailot_email_c22843_idx',
        ),
    ]

