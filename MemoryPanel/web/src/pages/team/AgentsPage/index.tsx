import { useAuthStore } from '@/stores/auth';
import { useCurrentRole } from '@/services/useCurrentRole';
import { useTeams } from '@/services';
import TeamManagementPanel from '@/pages/team/components/TeamManagementPanel';

export function AgentsPage() {
  const { auth } = useAuthStore();
  const role = useCurrentRole();
  const { activeTeamId } = useTeams();
  if (!auth) return null;

  return (
    <TeamManagementPanel
      currentUser={auth.user_id}
      instanceId={auth.instance_id}
      isAdmin={role === 'admin'}
      teamId={activeTeamId ?? ''}
      section="agents"
    />
  );
}