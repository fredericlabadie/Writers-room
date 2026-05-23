import * as amplitude from "@amplitude/unified";

// ── Helpers ────────────────────────────────────────────────────────────────────

const DOMAIN =
  typeof window !== "undefined" ? window.location.hostname : "writers-room";

function track(event: string, props: Record<string, string | undefined>) {
  amplitude.track(event, { Domain: DOMAIN, ...props });
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

// ── signInStarted ─────────────────────────────────────────────────────────────

export function trackSignInStarted(props: {
  auth_provider: string;
  entry_point: string;
  redirect_destination?: string;
}) {
  track("signInStarted", {
    AuthProvider: props.auth_provider,
    RequestedCalendarAccess: "false",
    EntryPoint: props.entry_point,
    RedirectDestination: props.redirect_destination ?? "/rooms",
  });
}

// ── signInCompleted ───────────────────────────────────────────────────────────

export function trackSignInCompleted(props: {
  auth_provider: string;
  calendar_access_granted: boolean;
  is_first_login: boolean;
  sign_in_method: string;
}) {
  track("signInCompleted", {
    AuthProvider: props.auth_provider,
    CalendarAccessGranted: String(props.calendar_access_granted),
    IsFirstLogin: String(props.is_first_login),
    SignInMethod: props.sign_in_method,
  });
}

// ── signOutCompleted ──────────────────────────────────────────────────────────

export function trackSignOutCompleted(sign_out_reason = "user_action") {
  track("signOutCompleted", { SignOutReason: sign_out_reason });
}

// ── calendarConnected ─────────────────────────────────────────────────────────

export function trackCalendarConnected(props: {
  auth_provider: string;
  calendar_scope_granted: string;
  connection_surface: string;
}) {
  setCalendarConnected();
  track("calendarConnected", {
    AuthProvider: props.auth_provider,
    CalendarScopeGranted: props.calendar_scope_granted,
    ConnectionSurface: props.connection_surface,
  });
}

// ── roomCreated ───────────────────────────────────────────────────────────────

export function trackRoomCreated(props: {
  room_id: string;
  room_type: string;
  creation_source: string;
  collaborator_count?: number;
}) {
  track("roomCreated", {
    RoomId: props.room_id,
    RoomType: props.room_type,
    CreationSource: props.creation_source,
    CollaboratorCount: String(props.collaborator_count ?? 1),
  });
}

// ── roomOpened ────────────────────────────────────────────────────────────────

export function trackRoomOpened(props: {
  room_id: string;
  open_source: string;
  is_first_open: boolean;
}) {
  track("roomOpened", {
    RoomId: props.room_id,
    OpenSource: props.open_source,
    IsFirstOpen: String(props.is_first_open),
  });
}

// ── sessionStarted ────────────────────────────────────────────────────────────

export function trackSessionStarted(props: {
  room_id: string;
  session_id: string;
  session_type: string;
  start_source: string;
}) {
  track("sessionStarted", {
    RoomId: props.room_id,
    SessionId: props.session_id,
    SessionType: props.session_type,
    StartSource: props.start_source,
  });
}

// ── agentRequestSubmitted ─────────────────────────────────────────────────────

export function trackAgentRequestSubmitted(props: {
  room_id: string;
  session_id: string;
  agent_type: string;
  request_type: string;
  input_length_chars: number;
  has_document_context: boolean;
  iteration_number: number;
}) {
  track("agentRequestSubmitted", {
    RoomId: props.room_id,
    SessionId: props.session_id,
    AgentType: props.agent_type,
    RequestType: props.request_type,
    InputLengthChars: String(props.input_length_chars),
    HasDocumentContext: String(props.has_document_context),
    IterationNumber: String(props.iteration_number),
  });
}

// ── agentResponseGenerated ────────────────────────────────────────────────────

export function trackAgentResponseGenerated(props: {
  room_id: string;
  session_id: string;
  agent_type: string;
  request_type: string;
  output_length_chars: number;
  latency_ms: number;
  model_name?: string;
}) {
  track("agentResponseGenerated", {
    RoomId: props.room_id,
    SessionId: props.session_id,
    AgentType: props.agent_type,
    RequestType: props.request_type,
    OutputLengthChars: String(props.output_length_chars),
    LatencyMs: String(props.latency_ms),
    ModelName: props.model_name ?? "claude",
  });
}

// ── outputApplied ─────────────────────────────────────────────────────────────

export function trackOutputApplied(props: {
  room_id: string;
  session_id: string;
  agent_type: string;
  apply_type: string;
  applied_length_chars: number;
}) {
  track("outputApplied", {
    RoomId: props.room_id,
    SessionId: props.session_id,
    AgentType: props.agent_type,
    ApplyType: props.apply_type,
    AppliedLengthChars: String(props.applied_length_chars),
  });
}

// ── contentSaved ──────────────────────────────────────────────────────────────

export function trackContentSaved(props: {
  room_id: string;
  content_id: string;
  content_type: string;
  save_method: string;
  word_count: number;
}) {
  track("contentSaved", {
    RoomId: props.room_id,
    ContentId: props.content_id,
    ContentType: props.content_type,
    SaveMethod: props.save_method,
    WordCount: String(props.word_count),
  });
}

// ── contentExported ───────────────────────────────────────────────────────────

export function trackContentExported(props: {
  room_id: string;
  content_id: string;
  content_type: string;
  export_format: string;
  export_destination: string;
  file_size_kb?: number;
}) {
  track("contentExported", {
    RoomId: props.room_id,
    ContentId: props.content_id,
    ContentType: props.content_type,
    ExportFormat: props.export_format,
    ExportDestination: props.export_destination,
    FileSizeKb:
      props.file_size_kb != null ? String(props.file_size_kb) : undefined,
  });
}

// ── feedbackSubmitted ─────────────────────────────────────────────────────────

export function trackFeedbackSubmitted(props: {
  feedback_context: string;
  agent_type: string;
  rating: string;
  feedback_category: string;
}) {
  track("feedbackSubmitted", {
    FeedbackContext: props.feedback_context,
    AgentType: props.agent_type,
    Rating: props.rating,
    FeedbackCategory: props.feedback_category,
  });
}

// ── calendarEventCreated ──────────────────────────────────────────────────────

export function trackCalendarEventCreated(props: {
  room_id: string;
  calendar_event_type: string;
  scheduled_start_at: string;
  duration_minutes: number;
  calendar_provider: string;
}) {
  track("calendarEventCreated", {
    RoomId: props.room_id,
    CalendarEventType: props.calendar_event_type,
    ScheduledStartAt: props.scheduled_start_at,
    DurationMinutes: String(props.duration_minutes),
    CalendarProvider: props.calendar_provider,
  });
}

// ── errorEncountered ──────────────────────────────────────────────────────────

export function trackErrorEncountered(props: {
  error_category: string;
  error_message: string;
  error_context: string;
  is_recoverable?: boolean;
}) {
  track("errorEncountered", {
    ErrorCategory: props.error_category,
    ErrorMessage: props.error_message.slice(0, 200),
    ErrorContext: props.error_context,
    IsRecoverable: String(props.is_recoverable ?? true),
  });
}
