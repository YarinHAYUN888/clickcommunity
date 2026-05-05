import { supabase } from '@/integrations/supabase/client';

export async function checkSuperUser(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('super_role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return (data as { super_role?: string | null } | null)?.super_role || null;
}

export async function getAdminStats() {
  const { data, error } = await supabase.functions.invoke('admin-get-stats');
  if (error) throw error;
  return data;
}

export async function getAdminUsers(filter?: string, search?: string, page = 1, limit = 20) {
  const { data, error } = await supabase.functions.invoke('admin-get-users', {
    body: { filter, search, page, limit },
  });
  if (error) throw error;
  return data;
}

/** Super-admin only — Edge Function validates JWT + super_role */
export async function createAdminGroupChat(display_name: string, participant_user_ids: string[]) {
  const { data, error } = await supabase.functions.invoke('create-group-chat', {
    body: { display_name, participant_user_ids },
  });
  if (error) throw error;
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as { success?: boolean; chat_id?: string };
}

export async function getAdminEventDetails(eventId: string) {
  const { data, error } = await supabase.functions.invoke('admin-get-event-details', {
    body: { event_id: eventId },
  });
  if (error) throw error;
  return data;
}

export async function performAdminAction(
  action: string,
  targetType: string,
  targetId?: string,
  details?: Record<string, any>
) {
  const { data, error } = await supabase.functions.invoke('admin-action', {
    body: { action, target_type: targetType, target_id: targetId || null, details },
  });
  if (error) throw error;
  return data;
}

export async function updateProfileSuitability(
  targetUserId: string,
  payload: { suitability_status: 'active' | 'pending' | 'shadow' | 'blocked'; is_shadow: boolean },
) {
  const { error } = await supabase
    .from('profiles')
    .update({
      suitability_status: payload.suitability_status,
      is_shadow: payload.is_shadow,
    })
    .eq('user_id', targetUserId);
  if (error) throw error;
}

export async function uploadEventCover(eventId: string, file: File) {
  const fileExt = file.name.split('.').pop();
  const filePath = `events/${eventId}/cover-${Date.now()}.${fileExt}`;
  const { error } = await supabase.storage.from('photos').upload(filePath, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('photos').getPublicUrl(filePath);
  return data.publicUrl;
}

export function exportRegistrationsCSV(registrations: any[]) {
  const headers = ['שם', 'טלפון', 'מגדר', 'סטטוס', 'תאריך הרשמה'];
  const rows = registrations.map((r: any) => [
    r.user?.first_name || '',
    r.user?.phone || '',
    r.user?.gender === 'male' ? 'גבר' : r.user?.gender === 'female' ? 'אישה' : 'אחר',
    r.status,
    new Date(r.created_at).toLocaleDateString('he-IL'),
  ]);
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `registrations-${Date.now()}.csv`;
  a.click();
}
