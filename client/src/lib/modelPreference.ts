import type { PreferredModel } from '../types';

export const MODEL_PREFERENCE_KEY = 'whatif_preferred_model';

export const PREFERRED_MODELS: PreferredModel[] = [
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
];

export function getPreferredModel(): PreferredModel {
    const saved = localStorage.getItem(MODEL_PREFERENCE_KEY);
    return PREFERRED_MODELS.includes(saved as PreferredModel)
        ? (saved as PreferredModel)
        : 'gemini-3-pro-preview';
}

export function setPreferredModel(model: PreferredModel) {
    localStorage.setItem(MODEL_PREFERENCE_KEY, model);
}
