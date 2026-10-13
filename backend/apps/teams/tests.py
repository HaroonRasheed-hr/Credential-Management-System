from django.test import TestCase
from rest_framework.test import APIClient

from apps.teams.models import Team, TeamMember
from apps.users.models import User


class OrganizationMembersViewTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@example.com',
            username='admin',
            role=User.Role.ADMIN,
        )
        self.member = User.objects.create_user(
            email='member@example.com',
            username='member',
            role=User.Role.DEVELOPER,
        )
        self.other_member = User.objects.create_user(
            email='other@example.com',
            username='other',
            role=User.Role.DEVELOPER,
        )

        self.team_one = Team.objects.create(name='Team One', created_by=self.admin)
        self.team_two = Team.objects.create(name='Team Two', created_by=self.admin)
        self.other_team = Team.objects.create(name='Other Team', created_by=self.other_member)
        self.membership_one = TeamMember.objects.create(
            team=self.team_one,
            user=self.member,
            role=TeamMember.Role.DEVELOPER,
        )
        self.membership_two = TeamMember.objects.create(
            team=self.team_two,
            user=self.member,
            role=TeamMember.Role.ADMIN,
        )
        TeamMember.objects.create(
            team=self.other_team,
            user=self.other_member,
            role=TeamMember.Role.ADMIN,
        )

    def test_admin_gets_deduplicated_members_in_one_query(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)

        with self.assertNumQueries(1):
            response = client.get('/api/v1/teams/members/')

        self.assertEqual(response.status_code, 200)
        members = response.data['data']
        self.assertEqual(len(members), 2)

        member = next(item for item in members if item['userId'] == str(self.member.id))
        expected_membership = {
            str(self.membership_one.id): TeamMember.Role.DEVELOPER,
            str(self.membership_two.id): TeamMember.Role.ADMIN,
        }
        self.assertIn(member['memberId'], expected_membership)
        self.assertEqual(member['role'], expected_membership[member['memberId']])
        self.assertEqual(
            {team['name'] for team in member['teams']},
            {'Team One', 'Team Two'},
        )
        self.assertNotIn('password_plaintext', member)

    def test_developer_only_gets_members_from_visible_teams(self):
        TeamMember.objects.create(
            team=self.team_one,
            user=self.other_member,
            role=TeamMember.Role.DEVELOPER,
        )
        client = APIClient()
        client.force_authenticate(user=self.member)

        response = client.get('/api/v1/teams/members/')

        self.assertEqual(response.status_code, 200)
        members = response.data['data']
        self.assertEqual(
            {member['userId'] for member in members},
            {str(self.member.id), str(self.other_member.id)},
        )
        self.assertEqual(
            {team['name'] for member in members for team in member['teams']},
            {'Team One', 'Team Two'},
        )

    def test_requires_authentication(self):
        response = APIClient().get('/api/v1/teams/members/')

        self.assertEqual(response.status_code, 401)
