export type PersonaId = "researcher" | "writer" | "editor" | "critic" | "director";

export interface Persona {
  id: PersonaId;
  name: string;
  handle: string;
  color: string;
  accent: string;
  icon: string;
  system: string;
}

export interface Message {
  id: string;
  role: "user" | "agent" | "system";
  persona?: PersonaId;
  content: string;
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
  invite_code: string | null;
  created_at: string;
  member_count?: number;
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
