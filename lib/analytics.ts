import * as amplitude from "@amplitude/unified";

// ── Helpers ────────────────────────────────────────────────────────────────────

const DOMAIN =
  typeof window !== "undefined" ? window.location.hostname : "writers-room";

function track(event: string, props: Record<string, string | undefined>) {
  amplitude.track(event, { domain: DOMAIN, ...props });
}

// ── User properties ────────────────────────────────────────────────────────────

export function setAuthUserProperties(props: {
  signup_method?: string;
  auth_provider: string;
  account_created_date?: string;
}) {
  const identify = new amplitude.Identify();
  if (props.signup_method)
    identify.setOnce("Signup Method", props.signup_method);
  identify.set("Auth Provider", props.auth_provider);
  if (props.account_created_date)
    identify.setOnce("Account Created Date", props.account_created_date);
  amplitude.identify(identify);
}

export function setOnboardingStatus(status: string) {
  const identify = new amplitude.Identify();
  identify.set("Onboarding Status", status);
  amplitude.identify(identify);
}

export function setCalendarConnected() {
  const identify = new amplitude.Identify();
  identify.set("Has Calendar Connected", "true");
  amplitude.identify(identify);
}

// ── Sign In Started ───────────────────────────────────────────────────────────

export function trackSignInStarted(props: {
  auth_provider: string;
  entry_point: string;
  redirect_destination?: string;
}) {
  track("Sign In Started", {
    auth_provider: props.auth_provider,
    requested_calendar_access: "false",
    entry_point: props.entry_point,
    redirect_destination: props.redirect_destination ?? "/rooms",
  });
}

// ── Sign In Completed ─────────────────────────────────────────────────────────

export function trackSignInCompleted(props: {
  auth_provider: string;
  calendar_access_granted: boolean;
  is_first_login: boolean;
  sign_in_method: string;
}) {
  track("Sign In Completed", {
    auth_provider: props.auth_provider,
    calendar_access_granted: String(props.calendar_access_granted),
    is_first_login: String(props.is_first_login),
    sign_in_method: props.sign_in_method,
  });
}

// ── Sign Out Completed ────────────────────────────────────────────────────────

export function trackSignOutCompleted(sign_out_reason = "user_action") {
  track("Sign Out Completed", { sign_out_reason });
}

// ── Calendar Connected ────────────────────────────────────────────────────────

export function trackCalendarConnected(props: {
  auth_provider: string;
  calendar_scope_granted: string;
  connection_surface: string;
}) {
  setCalendarConnected();
  track("Calendar Connected", {
    auth_provider: props.auth_provider,
    calendar_scope_granted: props.calendar_scope_granted,
    connection_surface: props.connection_surface,
  });
}

// ── Room Created ──────────────────────────────────────────────────────────────

export function trackRoomCreated(props: {
  room_id: string;
  room_type: string;
  creation_source: string;
  collaborator_count?: number;
}) {
  track("Room Created", {
    room_id: props.room_id,
    room_type: props.room_type,
    creation_source: props.creation_source,
    collaborator_count: String(props.collaborator_count ?? 1),
  });
}

// ── Room Opened ───────────────────────────────────────────────────────────────

export function trackRoomOpened(props: {
  room_id: string;
  open_source: string;
  is_first_open: boolean;
}) {
  track("Room Opened", {
    room_id: props.room_id,
    open_source: props.open_source,
    is_first_open: String(props.is_first_open),
  });
}

// ── Session Started ───────────────────────────────────────────────────────────

export function trackSessionStarted(props: {
  room_id: string;
  session_id: string;
  session_type: string;
  start_source: string;
}) {
  track("Session Started", {
    room_id: props.room_id,
    session_id: props.session_id,
    session_type: props.session_type,
    start_source: props.start_source,
  });
}

// ── Agent Request Submitted ───────────────────────────────────────────────────

export function trackAgentRequestSubmitted(props: {
  room_id: string;
  session_id: string;
  agent_type: string;
  request_type: string;
  input_length_chars: number;
  has_document_context: boolean;
  iteration_number: number;
}) {
  track("Agent Request Submitted", {
    room_id: props.room_id,
    session_id: props.session_id,
    agent_type: props.agent_type,
    request_type: props.request_type,
    input_length_chars: String(props.input_length_chars),
    has_document_context: String(props.has_document_context),
    iteration_number: String(props.iteration_number),
  });
}

// ── Agent Response Generated ──────────────────────────────────────────────────

export function trackAgentResponseGenerated(props: {
  room_id: string;
  session_id: string;
  agent_type: string;
  request_type: string;
  output_length_chars: number;
  latency_ms: number;
  model_name?: string;
}) {
  track("Agent Response Generated", {
    room_id: props.room_id,
    session_id: props.session_id,
    agent_type: props.agent_type,
    request_type: props.request_type,
    output_length_chars: String(props.output_length_chars),
    latency_ms: String(props.latency_ms),
    model_name: props.model_name ?? "claude",
  });
}

// ── Output Applied (direction pinned) ─────────────────────────────────────────

export function trackOutputApplied(props: {
  room_id: string;
  session_id: string;
  agent_type: string;
  apply_type: string;
  applied_length_chars: number;
}) {
  track("Output Applied", {
    room_id: props.room_id,
    session_id: props.session_id,
    agent_type: props.agent_type,
    apply_type: props.apply_type,
    applied_length_chars: String(props.applied_length_chars),
  });
}

// ── Content Saved ─────────────────────────────────────────────────────────────

export function trackContentSaved(props: {
  room_id: string;
  content_id: string;
  content_type: string;
  save_method: string;
  word_count: number;
}) {
  track("Content Saved", {
    room_id: props.room_id,
    content_id: props.content_id,
    content_type: props.content_type,
    save_method: props.save_method,
    word_count: String(props.word_count),
  });
}

// ── Content Exported ──────────────────────────────────────────────────────────

export function trackContentExported(props: {
  room_id: string;
  content_id: string;
  content_type: string;
  export_format: string;
  export_destination: string;
  file_size_kb?: number;
}) {
  track("Content Exported", {
    room_id: props.room_id,
    content_id: props.content_id,
    content_type: props.content_type,
    export_format: props.export_format,
    export_destination: props.export_destination,
    file_size_kb:
      props.file_size_kb != null ? String(props.file_size_kb) : undefined,
  });
}

// ── Feedback Submitted (emoji reaction) ───────────────────────────────────────

export function trackFeedbackSubmitted(props: {
  feedback_context: string;
  agent_type: string;
  rating: string;
  feedback_category: string;
}) {
  track("Feedback Submitted", {
    feedback_context: props.feedback_context,
    agent_type: props.agent_type,
    rating: props.rating,
    feedback_category: props.feedback_category,
  });
}

// ── Calendar Event Created ────────────────────────────────────────────────────

export function trackCalendarEventCreated(props: {
  room_id: string;
  calendar_event_type: string;
  scheduled_start_at: string;
  duration_minutes: number;
  calendar_provider: string;
}) {
  track("Calendar Event Created", {
    room_id: props.room_id,
    calendar_event_type: props.calendar_event_type,
    scheduled_start_at: props.scheduled_start_at,
    duration_minutes: String(props.duration_minutes),
    calendar_provider: props.calendar_provider,
  });
}

// ── Error Encountered ─────────────────────────────────────────────────────────

export function trackErrorEncountered(props: {
  error_category: string;
  error_message: string;
  error_context: string;
  is_recoverable?: boolean;
}) {
  track("Error Encountered", {
    error_category: props.error_category,
    error_message: props.error_message.slice(0, 200),
    error_context: props.error_context,
    is_recoverable: String(props.is_recoverable ?? true),
  });
}
