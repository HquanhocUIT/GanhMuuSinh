import type { Catalog, Quest, Vendor } from '../types';
import type { User } from '../auth';
export type ContentStatus = 'draft' | 'published' | 'archived';
export interface AdminVendor extends Omit<Vendor, 'lat' | 'lng' | 'price' | 'hours'> {
  lat: number | null;
  lng: number | null;
  price: number | null;
  hours: [number, number] | null;
  status: ContentStatus;
  revision: number;
  updatedAt: string;
}
export interface AdminQuest extends Omit<Quest, 'stops' | 'budget' | 'stopCount'> {
  vendorIds: string[];
  status: ContentStatus;
  revision: number;
  updatedAt: string;
}
export interface Submission {
  id: string;
  payload: {
    name: string;
    dish: string;
    region: string;
    address: string;
    lat: number | null;
    lng: number | null;
    price: number | null;
    hours: [number, number] | null;
    notes: string;
    sourceUrl: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  reviewNote: string;
  vendorId: string | null;
  createdAt: string;
  reviewedAt: string | null;
  author?: string;
}
export interface ReferencePlace {
  id: string;
  name: string;
  dish: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  sourceUrl: string;
  mapUrl: string;
  capturedAt: string;
  sourceUpdatedAt: string;
  sourceType?: 'google-maps';
  region?: 'saigon' | 'binhduong' | 'vungtau';
  area?: string;
  imported: boolean;
}
export interface Overview {
  regions: Catalog['regions'];
  allergens: Catalog['allergens'];
  counts: {
    vendors: number;
    publishedVendors: number;
    draftVendors: number;
    quests: number;
    publishedQuests: number;
    pending: number;
    users: number;
    stamps: number;
  };
  recent: {
    id: number;
    action: string;
    entityId: string;
    summary: string;
    createdAt: string;
    actor: string;
  }[];
}
export interface AdminData {
  overview: Overview;
  vendors: AdminVendor[];
  quests: AdminQuest[];
  submissions: Submission[];
  references: ReferencePlace[];
  users: User[];
}
export const statusLabel = (status: string) =>
  ({
    draft: 'Bản nháp',
    published: 'Đang hiển thị',
    archived: 'Đã lưu trữ',
    pending: 'Chờ xem xét',
    approved: 'Đã tiếp nhận',
    rejected: 'Cần bổ sung',
  })[status] ?? status;
export const formatDate = (date: string) =>
  new Date(date.includes('T') ? date : `${date.replace(' ', 'T')}Z`).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
