import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { BudgetMember, AppRole } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MembersDialogProps {
  budgetId: string;
  userRole: string;
}

export default function MembersDialog({ budgetId, userRole }: MembersDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<BudgetMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<AppRole>('viewer');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) fetchMembers();
  }, [open, budgetId]);

  const fetchMembers = async () => {
    try {
      const data = await apiRequest<{ members: BudgetMember[] }>(
        `/api/budgets/${budgetId}/members`
      );
      setMembers(data.members);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load members',
        variant: 'destructive',
      });
    }
  };

  const addMember = async () => {
    if (!newMemberEmail.trim()) return;
    setLoading(true);
    try {
      await apiRequest(`/api/budgets/${budgetId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: newMemberEmail.trim(), role: newMemberRole }),
      });
      toast({ title: 'Success', description: 'Member added successfully!' });
      setNewMemberEmail('');
      fetchMembers();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add member',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (memberId: string, newRole: AppRole) => {
    try {
      await apiRequest(`/api/budgets/${budgetId}/members/${memberId}`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      toast({ title: 'Success', description: 'Role updated successfully!' });
      fetchMembers();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update role',
        variant: 'destructive',
      });
    }
  };

  const removeMember = async (memberId: string, memberUserId: string) => {
    if (memberUserId === user?.id) {
      toast({ title: 'Error', description: 'You cannot remove yourself', variant: 'destructive' });
      return;
    }
    try {
      await apiRequest(`/api/budgets/${budgetId}/members/${memberId}`, { method: 'DELETE' });
      toast({ title: 'Success', description: 'Member removed successfully!' });
      fetchMembers();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove member',
        variant: 'destructive',
      });
    }
  };

  const canManageMembers = userRole === 'admin';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="mr-2 h-4 w-4" />
          Members
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Members</DialogTitle>
          <DialogDescription>
            {canManageMembers
              ? 'Add or remove members and manage their permissions'
              : 'View budget members'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {canManageMembers && (
            <div className="space-y-3 p-4 border rounded-lg">
              <Label>Add Member by Email</Label>
              <Input
                placeholder="member@example.com"
                type="email"
                value={newMemberEmail}
                onChange={e => setNewMemberEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMember()}
              />
              <div className="flex gap-2">
                <Select
                  value={newMemberRole}
                  onValueChange={value => setNewMemberRole(value as AppRole)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addMember} disabled={loading}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The person must already have an account to be added.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Current Members</Label>
            {members.map(member => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {member.display_name || member.email}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  {member.user_id === user?.id && (
                    <Badge variant="outline" className="text-xs mt-1">
                      You
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  {canManageMembers && member.user_id !== user?.id ? (
                    <>
                      <Select
                        value={member.role}
                        onValueChange={value => updateRole(member.id, value as AppRole)}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember(member.id, member.user_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Badge>{member.role}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
