export type PersonaId = string;

export type RoomType = "writers" | "jobhunt" | "career" | "publishing";

export interface PersonaGenerationSettings {
  temperature: number;
  maxTokens: number;
}

export interface Persona {
  id: PersonaId;
  name: string;
  handle: string;
  color: string;
  accent: string;
  icon: string;
  system: string;
  generation: PersonaGenerationSettings;
  role: string;
  tagline: string;
}

export interface Message {
  id: string;
  role: "user" | "agent" | "system";
  persona?: PersonaId;
  content: string;
  citations?: ArtifactCitation[];
  retrieval_debug?: RetrievalDebugInfo;
  artifact_ids?: string[];
  section_id?: string | null;
  section_name?: string | null;
  user_id?: string;
  user_name?: string;
  user_avatar?: string;
  created_at: string;
}

export interface Room {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  is_private: boolean;
  room_type: RoomType;
  invite_code: string | null;
  notebooklm_url: string | null;
  active_tone: SpotifyTone | null;
  notes: string | null;
  folder_id: string | null;
  created_at: string;
  member_count?: number;
}

export interface Folder {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  genre: string | null;
  reader: string | null;
  tone: string | null;
  about: string | null;
  created_at: string;
  // Derived fields (from joins)
  room_count?: number;
  pin_count?: number;
}

export interface FolderPin {
  id: string;
  folder_id: string;
  text: string;
  created_by: string | null;
  created_at: string;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
}

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Artifact {
  id: string;
  room_id: string;
  uploaded_by: string | null;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  kind: "document" | "image";
  parse_status: "pending" | "processing" | "ready" | "failed";
  parse_error?: string | null;
  created_at: string;
}

export interface ArtifactCitation {
  artifactId: string;
  artifactName: string;
  chunkId: string;
  chunkIndex: number;
  score: number;
}

export type RetrievalMode = "room_wide" | "selected_only";

export interface RetrievalSettings {
  mode: RetrievalMode;
  topK: number;
  threshold: number;
  selectedArtifactIds?: string[];
}

export interface RetrievalDebugInfo {
  mode: RetrievalMode;
  topK: number;
  threshold: number;
  retrievedCount: number;
  usedArtifactIds: string[];
  maxScore: number;
}

export interface SectionMoodProfile {
  moodLabel: string;
  descriptors: string[];
  guidance: string;
  source: "spotify_audio_features" | "spotify_metadata_fallback";
  metrics?: {
    valence?: number;
    energy?: number;
    danceability?: number;
    acousticness?: number;
    instrumentalness?: number;
    tempo?: number;
  };
}

export interface RoomSection {
  id: string;
  room_id: string;
  name: string;
  created_by: string | null;
  spotify_url: string | null;
  spotify_track_id: string | null;
  spotify_track_name: string | null;
  spotify_artist_name: string | null;
  mood_profile: SectionMoodProfile | null;
  created_at: string;
  updated_at: string;
}

export interface SpotifyTone {
  trackName: string;
  artistName: string;
  descriptor: string;
  moodTags: string[];
  energy: number;
  valence: number;
}

export interface ReviewLink {
  id: string;
  room_id: string;
  token: string;
  created_by: string;
  expires_at: string | null;
  created_at: string;
}
