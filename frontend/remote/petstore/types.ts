
export enum PetType {
  CAT = 'CAT',
  DOG = 'DOG',
  LIZARD = 'LIZARD',
  BIRD = 'BIRD',
  FISH = 'FISH',
  HAMSTER = 'HAMSTER'
}

export enum Skill {
  PETTING = 'PETTING',
  FEEDING = 'FEEDING',
  WALKING = 'WALKING',
  MEDICATING = 'MEDICATING',
  SHAVING = 'SHAVING'
}

export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY'
}

export interface Customer {
  id: string;
  name: string;
  phoneNumber: string;
}

export interface Pet {
  id: string;
  type: PetType;
  name: string;
  ownerId: string;
  birthDate: string;
  notes?: string;
}

export interface Employee {
  id: string;
  name: string;
  skills: Skill[];
  daysAvailable: DayOfWeek[];
}

export interface Schedule {
  id: string;
  employeeIds: string[];
  petIds: string[];
  date: string;
  activities: Skill[];
}

export interface ScheduleRequest {
  employeeIds: string[];
  petIds: string[];
  date: string;
  activities: Skill[];
}

export interface AvailabilityRequest {
  date: string;
  skills: Skill[];
}

// --- CloudApp Types ---

export interface CloudUser {
  id: number;
  username: string;
  password?: string; // In real app, don't store this on client
  token?: string;
  joinedRooms?: string[]; // List of room codes
}

export interface Note {
  id: number;
  title: string;
  description: string;
  userid: number;
  username?: string; // For display if needed
}

export interface FileMetadata {
  id: number;
  name: string;
  contentType: string;
  fileSize: string;
  userid: number;
  fileName: string; // Display name
  fileId: number;
}

export interface Item {
  id: number;
  name: string;
  price: number;
  description: string;
}

export interface Cart {
  id: number;
  items: Item[];
  user?: CloudUser;
  total: number;
}

export interface UserOrder {
  id: number;
  items: Item[];
  user: CloudUser;
  total: number;
  date?: string;
}

export interface Room {
  name: string;
  code: string;
  createdBy: string;
}

export interface RoomMessage {
  id: string;
  roomId: string; // Matches Room.code
  sender: string;
  content: string;
  timestamp: string;
}

export interface ApiResponse<T> {
  err_code: number;
  err_msg: string;
  data: T;
}

// --- Jira Types ---

export interface JiraTicket {
  key: string;
  fields: {
    summary: string;
    description: string;
    issuetype: { name: string };
    parent?: { key: string };
    project?: { key: string };
  };
  children?: JiraTicket[]; // Helper for UI tree structure
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// --- Maps / Vehicle Types ---
export interface Vehicle {
    id: string;
    condition: 'NEW' | 'USED';
    details: {
        body: string;
        model: string;
        manufacturer: {
            code: number;
            name: string;
        };
        numberOfDoors: number;
        fuelType: string;
        engine: string;
        mileage: number;
        modelYear: number;
        productionYear: number;
        externalColor: string;
    };
    location: {
        lat: number;
        lon: number;
    };
}

// --- MLOps Types ---
export interface MLCustomer {
    id: string;
    gender: string;
    age: number;
    annual_income: number;
    spending_score: number;
    segment: number;
}

export interface MLImages {
    image2: string; // Base64
    image3: string; // Base64
    image4: string; // Base64
}
