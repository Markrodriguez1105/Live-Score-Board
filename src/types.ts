export interface Candidate {
    name: string;
    category?: string;
    photoUrl: string;
    scores: number[];
    totalPercentage: number;
}
