import { ActivityType } from "@prisma/client";

export interface Activity {
  id: string;
  type: ActivityType;
  description: string;
  createdAt: Date;
  userId: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    status: string;
  };
}

export interface ActivityResponse {
  activities: Activity[];
  total: number;
  page: number;
  pageSize: number;
}
