export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  AGENT = 'agent',
}

export enum LeadStatus {
  NEW = 'new',
  DIALED = 'dialed',
  NOT_INTERESTED = 'not_interested',
  CALLBACK = 'callback',
  INTERESTED = 'interested',
  DNC = 'dnc',
  CONVERTED = 'converted',
  INVALID = 'invalid',
}

export enum CallStatus {
  INITIATED = 'initiated',
  RINGING = 'ringing',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  BUSY = 'busy',
  NO_ANSWER = 'no_answer',
}

export interface IUser {
  _id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILead {
  _id: string;
  name: string;
  email?: string;
  phone: string;
  company?: string;
  assignedTo: string | IUser;
  status: LeadStatus;
  score: number;
  notes: string;
  lastCallDate?: Date;
  nextFollowUp?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICall {
  _id: string;
  lead: string | ILead;
  agent: string | IUser;
  twilioCallSid?: string;
  duration: number;
  status: CallStatus;
  recording?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Add to existing types
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}