declare module 'random-weighted-choice' {
	export interface RWCElement {
		weight: number;
		id: string;
	}

	export default function (table: RWCElement[], temperature?: number): string;
}
