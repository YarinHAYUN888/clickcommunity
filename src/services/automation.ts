import { FunctionsHttpError } from '@supabase/functions-js';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { applyTemplateVars, type TemplateContext } from '@/lib/templateVariables';

export type AutomationWebhookPayload = {
  mode: string;
  trigger: string;
  template: {
    id?: string;
    subject: string;
    body: string;
    /** Populated server-side by automation-dispatch for n8n HTML email */
    body_html?: string;
    body_plain?: string;
  };
  recipient: {
    user_id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  event?: {
    id?: string;
    name?: string;
    date?: string;
    time?: string;
    location_name?: string;
    location_address?: string;
  };
  metadata?: Record<string, unknown>;
};

export type RecipientDispatchMode = 'manual_test' | 'single_user' | 'segment_member';

export type AutomationSegmentFilters = {
  min_points?: number;
  gender?: string;
  event_id?: string;
  registration_filter?: string;
};

export type RecipientUser = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string;
  date_of_birth: string | null;
  points: number | null;
  role: string | null;
  status: string | null;
  suitability_status?: string;
  moderation_status?: string;
  last_seen?: string | null;
  gender?: string | null;
  profile_completed?: boolean | null;
};

export async function fetchTemplates() {
  const { data, error } = await supabase
    .from('automation_templates')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createTemplate(row: {
  name: string;
  subject: string;
  body: string;
  category?: string;
  status?: string;
  builder_document?: Json | null;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('automation_templates')
    .insert({
      name: row.name,
      subject: row.subject,
      body: row.body,
      category: row.category ?? 'custom',
      status: row.status ?? 'active',
      is_system: false,
      created_by: user?.id ?? null,
      ...(row.builder_document !== undefined && row.builder_document !== null
        ? { builder_document: row.builder_document }
        : {}),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateTemplate(
  id: string,
  updates: Partial<{
    name: string;
    subject: string;
    body: string;
    category: string;
    status: string;
    builder_document: Json | null;
  }>,
) {
  const { data, error } = await supabase.from('automation_templates').update(updates).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteTemplate(id: string) {
  const { error } = await supabase.from('automation_templates').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchFlows() {
  const { data, error } = await supabase
    .from('automation_flows')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveFlow(row: {
  id?: string;
  name: string;
  trigger_type: string;
  conditions: Json;
  actions: Json;
  template_id?: string | null;
  is_active: boolean;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (row.id) {
    const { data, error } = await supabase
      .from('automation_flows')
      .update({
        name: row.name,
        trigger_type: row.trigger_type,
        conditions: row.conditions,
        actions: row.actions,
        template_id: row.template_id ?? null,
        is_active: row.is_active,
      })
      .eq('id', row.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from('automation_flows')
    .insert({
      name: row.name,
      trigger_type: row.trigger_type,
      conditions: row.conditions,
      actions: row.actions,
      template_id: row.template_id ?? null,
      is_active: row.is_active,
      created_by: user?.id ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFlow(id: string) {
  const { error } = await supabase.from('automation_flows').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchLogs(limit = 80) {
  const { data, error } = await supabase
    .from('automation_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function invokeRecipients(
  body: Record<string, unknown>,
): Promise<{ users?: RecipientUser[]; today?: RecipientUser[]; error?: string } & Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('automation-recipients', { body });
  if (error) throw error;
  const payload = data as { error?: string } | null;
  if (payload && typeof payload.error === 'string' && payload.error.length > 0) {
    throw new Error(payload.error);
  }
  return data as { users?: RecipientUser[]; today?: RecipientUser[]; error?: string } & Record<string, unknown>;
}

export async function searchAutomationUsers(
  q: string,
  limit = 25,
): Promise<{ users?: RecipientUser[] } & Record<string, unknown>> {
  return invokeRecipients({ action: 'search_users', q, limit });
}

export async function listAutomationSegment(params: {
  segment: string;
  limit?: number;
  segment_filters?: AutomationSegmentFilters;
}): Promise<{ users?: RecipientUser[] } & Record<string, unknown>> {
  return invokeRecipients({
    action: 'list_segment',
    segment: params.segment,
    limit: params.limit ?? 500,
    ...(params.segment_filters ? { segment_filters: params.segment_filters } : {}),
  });
}

export type AutomationDispatchResult = {
  success: boolean;
  error?: string;
  message?: string;
  http_status?: number;
  webhook_url_type?: string;
  webhook_error_detail?: string;
};

export async function invokeDispatch(params: {
  intent: 'test_send' | 'campaign';
  automation: AutomationWebhookPayload;
  template_id?: string | null;
  flow_id?: string | null;
  recipient_mode?: RecipientDispatchMode;
  recipient_user_id?: string | null;
  segment_key?: string | null;
  manual_test_email?: string | null;
  segment_filters?: AutomationSegmentFilters | null;
}): Promise<AutomationDispatchResult> {
  const { data, error } = await supabase.functions.invoke('automation-dispatch', {
    body: {
      intent: params.intent,
      automation: params.automation,
      template_id: params.template_id ?? null,
      flow_id: params.flow_id ?? null,
      ...(params.recipient_mode ? { recipient_mode: params.recipient_mode } : {}),
      ...(params.recipient_user_id ? { recipient_user_id: params.recipient_user_id } : {}),
      ...(params.segment_key != null && params.segment_key !== ''
        ? { segment_key: params.segment_key }
        : {}),
      ...(params.manual_test_email ? { manual_test_email: params.manual_test_email } : {}),
      ...(params.segment_filters && Object.keys(params.segment_filters).length > 0
        ? { segment_filters: params.segment_filters }
        : {}),
    },
  });

  if (!error) {
    const payload = data as AutomationDispatchResult | null;
    if (payload && typeof payload.error === 'string' && payload.error.length > 0) {
      return {
        success: false,
        error: payload.error,
        message: payload.message,
        http_status: payload.http_status,
        webhook_url_type: payload.webhook_url_type,
        webhook_error_detail: payload.webhook_error_detail,
      };
    }
    return {
      success: !!payload?.success,
      message: payload?.message,
      http_status: payload?.http_status,
      webhook_url_type: payload?.webhook_url_type,
    };
  }

  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    const httpStatus = res.status;
    let body: Record<string, unknown> | null = null;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      body = null;
    }

    if (httpStatus === 401) {
      throw new Error(typeof body?.error === 'string' ? body.error : 'Unauthorized');
    }

    if (httpStatus === 403 || httpStatus === 400) {
      const errCode = typeof body?.error === 'string' ? body.error : 'request_failed';
      const msg = typeof body?.message === 'string' ? body.message : undefined;
      return {
        success: false,
        error: errCode,
        message: msg,
        http_status: httpStatus,
      };
    }

    if (body && typeof body.error === 'string' && body.error.length > 0) {
      if (body.error === 'webhook_not_configured') {
        return {
          success: false,
          error: body.error,
          http_status: httpStatus,
        };
      }
      throw new Error(body.error);
    }

    if (body && body.success === false) {
      return {
        success: false,
        message: typeof body.message === 'string' ? body.message : undefined,
        http_status: typeof body.http_status === 'number' ? body.http_status : httpStatus,
        webhook_url_type: typeof body.webhook_url_type === 'string' ? body.webhook_url_type : undefined,
        webhook_error_detail:
          typeof body.webhook_error_detail === 'string' ? body.webhook_error_detail : undefined,
      };
    }
  }

  throw error instanceof Error ? error : new Error(String(error));
}

export function recipientToTemplateContext(r: RecipientUser, extra?: TemplateContext): TemplateContext {
  const birth = r.date_of_birth;
  let birthday = '';
  if (birth) {
    try {
      birthday = new Date(birth).toLocaleDateString('he-IL');
    } catch {
      birthday = birth;
    }
  }
  return {
    first_name: r.first_name || '',
    last_name: r.last_name || '',
    email: r.email || '',
    phone: r.phone || '',
    points: r.points ?? 0,
    birthday,
    ...extra,
  };
}

export function buildPayloadFromTemplate(
  mode: 'test' | 'production',
  trigger: string,
  template: { id: string; subject: string; body: string },
  recipient: RecipientUser,
  ctx: TemplateContext,
  event?: {
    id?: string;
    name?: string;
    date?: string;
    time?: string;
    location_name?: string;
    location_address?: string;
  },
): AutomationWebhookPayload {
  const p: AutomationWebhookPayload = {
    mode,
    trigger,
    template: {
      id: template.id,
      subject: applyTemplateVars(template.subject, ctx),
      body: applyTemplateVars(template.body, ctx),
    },
    recipient: {
      user_id: recipient.user_id,
      first_name: recipient.first_name || '',
      last_name: recipient.last_name || '',
      email: recipient.email,
      phone: recipient.phone || '',
    },
    metadata: {
      raw_template_id: template.id,
    },
  };
  if (event && (event.id || event.name)) {
    p.event = {
      id: event.id,
      name: event.name,
      date: event.date,
      time: event.time,
      location_name: event.location_name,
      location_address: event.location_address,
    };
  }
  return p;
}

export function eventToTemplateContext(ev: {
  name: string;
  date?: string | null;
  time?: string | null;
  location_name?: string | null;
  location_address?: string | null;
}): TemplateContext {
  return {
    event_name: ev.name,
    event_date: ev.date ? String(ev.date) : '',
    event_time: ev.time ? String(ev.time) : '',
    location_name: ev.location_name ? String(ev.location_name) : '',
    location_address: ev.location_address ? String(ev.location_address) : '',
  };
}

export async function duplicateTemplate(id: string) {
  const { data: src, error: fe } = await supabase.from('automation_templates').select('*').eq('id', id).maybeSingle();
  if (fe) throw fe;
  if (!src) throw new Error('template_not_found');
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('automation_templates')
    .insert({
      name: `${src.name} (עותק)`,
      subject: src.subject,
      body: src.body,
      category: src.category,
      status: 'draft',
      is_system: false,
      created_by: user?.id ?? null,
      ...(src.builder_document != null ? { builder_document: src.builder_document as Json } : {}),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function invokeRetryAutomationLog(logId: string): Promise<AutomationDispatchResult> {
  const { data, error } = await supabase.functions.invoke('automation-retry-log', {
    body: { log_id: logId },
  });
  if (!error) {
    const payload = data as (AutomationDispatchResult & { error?: string }) | null;
    if (payload && typeof payload.error === 'string' && payload.error.length > 0) {
      return {
        success: false,
        error: payload.error,
        message: payload.message,
        http_status: payload.http_status,
        webhook_url_type: payload.webhook_url_type,
        webhook_error_detail: payload.webhook_error_detail,
      };
    }
    return {
      success: !!payload?.success,
      message: payload?.message,
      http_status: payload?.http_status,
      webhook_url_type: payload?.webhook_url_type,
    };
  }
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    const httpStatus = res.status;
    let body: Record<string, unknown> | null = null;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      body = null;
    }
    if (httpStatus === 401) {
      throw new Error(typeof body?.error === 'string' ? body.error : 'Unauthorized');
    }
    return {
      success: false,
      error: typeof body?.error === 'string' ? body.error : 'retry_failed',
      message: typeof body?.message === 'string' ? body.message : undefined,
      http_status: httpStatus,
    };
  }
  throw error instanceof Error ? error : new Error(String(error));
}
