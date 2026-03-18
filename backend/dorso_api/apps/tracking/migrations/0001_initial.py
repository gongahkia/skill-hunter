"""
Initial tracking models with source-aware attempt metadata.
"""

import django.core.validators
import django.db.models.deletion
from django.db import migrations, models

import dorso_api.apps.tracking.models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='ExtensionUser',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('extension_id', models.CharField(db_index=True, help_text='Unique identifier from browser extension runtime', max_length=255, unique=True)),
                ('browser', models.CharField(choices=[('chrome', 'Google Chrome'), ('firefox', 'Mozilla Firefox'), ('edge', 'Microsoft Edge'), ('other', 'Other')], default='chrome', max_length=50)),
                ('first_seen', models.DateTimeField(auto_now_add=True)),
                ('last_active', models.DateTimeField(auto_now=True)),
                ('total_solves', models.IntegerField(default=0, validators=[django.core.validators.MinValueValidator(0)])),
                ('current_streak', models.IntegerField(default=0, validators=[django.core.validators.MinValueValidator(0)])),
                ('longest_streak', models.IntegerField(default=0, validators=[django.core.validators.MinValueValidator(0)])),
                ('last_solved_at', models.DateTimeField(blank=True, null=True)),
                ('total_attempts', models.IntegerField(default=0, validators=[django.core.validators.MinValueValidator(0)])),
                ('is_active', models.BooleanField(default=True)),
                ('preferred_difficulties', models.JSONField(blank=True, default=list)),
                ('preferred_topics', models.JSONField(blank=True, default=list)),
                ('enabled_verified_sources', models.JSONField(blank=True, default=dorso_api.apps.tracking.models.default_verified_sources)),
                ('codeforces_handle', models.CharField(blank=True, default='', max_length=255)),
                ('codewars_username', models.CharField(blank=True, default='', max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Extension User',
                'verbose_name_plural': 'Extension Users',
                'db_table': 'extension_users',
                'ordering': ['-last_active'],
            },
        ),
        migrations.CreateModel(
            name='ProblemAttempt',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('problem_slug', models.CharField(db_index=True, max_length=255)),
                ('problem_title', models.CharField(max_length=500)),
                ('difficulty', models.CharField(choices=[('Easy', 'Easy'), ('Medium', 'Medium'), ('Hard', 'Hard')], max_length=20)),
                ('source', models.CharField(choices=[('leetcode', 'LeetCode'), ('codeforces', 'Codeforces'), ('codewars', 'Codewars'), ('exercism', 'Exercism')], db_index=True, default='leetcode', max_length=32)),
                ('challenge_id', models.CharField(blank=True, default='', max_length=255)),
                ('topic_tags', models.JSONField(blank=True, default=list)),
                ('attempted_at', models.DateTimeField(auto_now_add=True)),
                ('solved', models.BooleanField(default=False)),
                ('time_taken_seconds', models.IntegerField(blank=True, help_text='Time from problem display to successful submission', null=True, validators=[django.core.validators.MinValueValidator(0)])),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attempts', to='tracking.extensionuser')),
            ],
            options={
                'verbose_name': 'Problem Attempt',
                'verbose_name_plural': 'Problem Attempts',
                'db_table': 'problem_attempts',
                'ordering': ['-attempted_at'],
            },
        ),
        migrations.CreateModel(
            name='AccessLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('chatbot_url', models.URLField(max_length=500)),
                ('chatbot_name', models.CharField(help_text='Friendly name (ChatGPT, Claude, etc.)', max_length=100)),
                ('accessed_at', models.DateTimeField(auto_now_add=True)),
                ('problem_solved_for_access', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='granted_accesses', to='tracking.problemattempt')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='access_logs', to='tracking.extensionuser')),
            ],
            options={
                'verbose_name': 'Access Log',
                'verbose_name_plural': 'Access Logs',
                'db_table': 'access_logs',
                'ordering': ['-accessed_at'],
            },
        ),
        migrations.CreateModel(
            name='UserSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('session_start', models.DateTimeField(auto_now_add=True)),
                ('session_end', models.DateTimeField()),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('problem_attempt', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sessions', to='tracking.problemattempt')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sessions', to='tracking.extensionuser')),
            ],
            options={
                'verbose_name': 'User Session',
                'verbose_name_plural': 'User Sessions',
                'db_table': 'user_sessions',
                'ordering': ['-session_start'],
            },
        ),
        migrations.AddIndex(
            model_name='extensionuser',
            index=models.Index(fields=['extension_id'], name='extension_u_extensi_e89e4e_idx'),
        ),
        migrations.AddIndex(
            model_name='extensionuser',
            index=models.Index(fields=['-last_active'], name='extension_u_last_ac_11e886_idx'),
        ),
        migrations.AddIndex(
            model_name='extensionuser',
            index=models.Index(fields=['-total_solves'], name='extension_u_total_s_1e7ad1_idx'),
        ),
        migrations.AddIndex(
            model_name='problemattempt',
            index=models.Index(fields=['user', '-attempted_at'], name='problem_att_user_id_65d8ca_idx'),
        ),
        migrations.AddIndex(
            model_name='problemattempt',
            index=models.Index(fields=['problem_slug'], name='problem_att_problem__798e08_idx'),
        ),
        migrations.AddIndex(
            model_name='problemattempt',
            index=models.Index(fields=['source'], name='problem_att_source_4699d0_idx'),
        ),
        migrations.AddIndex(
            model_name='problemattempt',
            index=models.Index(fields=['solved'], name='problem_att_solved_1eceaf_idx'),
        ),
        migrations.AddIndex(
            model_name='problemattempt',
            index=models.Index(fields=['-attempted_at'], name='problem_att_attempt_1cbe52_idx'),
        ),
        migrations.AddIndex(
            model_name='accesslog',
            index=models.Index(fields=['user', '-accessed_at'], name='access_logs_user_id_a2b7a1_idx'),
        ),
        migrations.AddIndex(
            model_name='accesslog',
            index=models.Index(fields=['-accessed_at'], name='access_logs_accessed_628ec6_idx'),
        ),
        migrations.AddIndex(
            model_name='usersession',
            index=models.Index(fields=['user', 'is_active'], name='user_sessio_user_id_69c729_idx'),
        ),
        migrations.AddIndex(
            model_name='usersession',
            index=models.Index(fields=['session_end'], name='user_sessio_session_b6e441_idx'),
        ),
        migrations.AddIndex(
            model_name='usersession',
            index=models.Index(fields=['-session_start'], name='user_sessio_session_3f61ab_idx'),
        ),
    ]
