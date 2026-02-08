import type { SportKey } from "@/entities/sport/model/types";

export type League = {
    id: string;
    name: string;
    country?: string | null;
    sportKey: SportKey;
};