import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

interface Member {
  id: string;
  user_id: string;
  role: 'admin' | 'editor' | 'viewer';
  display_name: string | null;
}

interface MembersDialogProps {
  budgetId: string;
  userRole: string;
}

export default function MembersDialog({ budgetId, userRole }: MembersDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'editor' | 'viewer'>('viewer');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchMembers();
    }
  }, [open, budgetId]);

  const fetchMembers = async () => {
    try {
      const { data: membersData, error } = await supabase
        .from('budget_members')
        .select('id, user_id, role')
        .eq('budget_id', budgetId);

      if (error) throw error;

      // Fetch profile data separately
      const enrichedMembers = await Promise.all(
        (membersData || []).map(async (member) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', member.user_id)
            .single();

          return {
            ...member,
            display_name: profile?.display_name || null,
          };
        })
      );

      setMembers(enrichedMembers);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const addMember = async () => {
    if (!newMemberEmail.trim()) return;
    
    setLoading(true);
    try {
      // First, find user by email
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', newMemberEmail) // This won't work as expected
        .single();

      // Note: In production, you'd need an edge function to look up users by email
      // For now, users need to enter the user ID
      
      toast({
        title: 'Note',
        description: 'User lookup by email requires an edge function. Please enter the user ID instead.',
        variant: 'destructive',
      });

      const { error } = await supabase
        .from('budget_members')
        .insert([
          {
            budget_id: budgetId,
            user_id: newMemberEmail, // Treating as user ID for now
            role: newMemberRole,
          },
        ]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Member added successfully!',
      });

      setNewMemberEmail('');
      fetchMembers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (memberId: string, newRole: 'admin' | 'editor' | 'viewer') => {
    try {
      const { error } = await supabase
        .from('budget_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Role updated successfully!',
      });

      fetchMembers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const removeMember = async (memberId: string, memberUserId: string) => {
    if (memberUserId === user?.id) {
      toast({
        title: 'Error',
        description: 'You cannot remove yourself',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('budget_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Member removed successfully!',
      });

      fetchMembers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
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
              <Label>Add Member (User ID)</Label>
              <Input
                placeholder="Enter user ID"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
              />
              <div className="flex gap-2">
                <Select value={newMemberRole} onValueChange={(value) => setNewMemberRole(value as 'admin' | 'editor' | 'viewer')}>
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
            </div>
          )}

          <div className="space-y-2">
            <Label>Current Members</Label>
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">
                    {member.display_name || 'Unknown User'}
                  </p>
                  {member.user_id === user?.id && (
                    <Badge variant="outline" className="text-xs mt-1">
                      You
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canManageMembers && member.user_id !== user?.id ? (
                    <>
                      <Select
                        value={member.role}
                        onValueChange={(value) => updateRole(member.id, value as 'admin' | 'editor' | 'viewer')}
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
