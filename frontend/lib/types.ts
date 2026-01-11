// Core types for the application

export type ProjectStatus = 'pending' | 'scanning' | 'generating' | 'ready' | 'error';

// Employee-focused document types for supporting end-users
export type DocType =
  | 'overview'        // Platform Overview - what the product does
  | 'how_it_works'    // How It Works - simple system explanation
  | 'training'        // Employee Training - how to support users
  | 'terms'           // Terms & Features - what things mean to users
  | 'user_journeys'   // User Journeys - common tasks users do
  | 'troubleshooting' // Troubleshooting - common problems and solutions
  | 'custom';         // Custom documents

export type VideoStatus = 'pending' | 'generating' | 'ready' | 'error';

// Database types
export interface Project {
  id: string;
  github_url: string;
  commit_sha: string;
  status: ProjectStatus;
  project_md: string | null;
  created_at: string;
  repo_name: string;
  error_message?: string | null;
}

export interface Document {
  id: string;
  project_id: string;
  type: DocType;
  title: string;
  content: string;
  diagram_url: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  project_id: string;
  messages: Message[];
  created_at: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

export interface Citation {
  path: string;
  lineStart?: number;
  lineEnd?: number;
  excerpt?: string;
}

export interface Video {
  id: string;
  document_id: string;
  status: VideoStatus;
  video_url: string | null;
  transcript: string | null;
  storyboard: Storyboard | null;
  created_at: string;
}

export interface Storyboard {
  slides: Slide[];
}

export interface Slide {
  title: string;
  bullets: string[];
  imagePrompt: string;
  voiceover: string;
  imageUrl?: string;
  audioUrl?: string;
}

export interface FileCache {
  id: string;
  project_id: string;
  file_path: string;
  content: string;
  line_count: number;
}

// Tool result types
export interface TreeEntry {
  path: string;
  type: 'file' | 'directory';
  size: number;
}

export interface GrepHit {
  path: string;
  lineNo: number;
  excerpt: string;
}

// Repository info
export interface RepoInfo {
  owner: string;
  repo: string;
  branch: string;
  commitSha: string;
}

