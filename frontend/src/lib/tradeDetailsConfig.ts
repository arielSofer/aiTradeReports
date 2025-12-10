
export interface TradeCategory {
    id: string;
    name: string;
    options: string[];
}

export const TRADE_DETAILS_CONFIG: TradeCategory[] = [
    {
        id: 'trade_management',
        name: 'Trade Management',
        options: [
            'exited emotionally',
            'increased leverage',
            'manual close early',
            'moved sl to b/e',
            'moved sl wider',
            'partial tp',
            'trailed stop properly'
        ]
    },
    {
        id: 'sleep',
        name: 'Sleep',
        options: [
            'bad sleep',
            'good sleep',
            'okay sleep',
            'slept < 5 hours',
            'slept 6-8 hours',
            'slept 8+ hours'
        ]
    },
    {
        id: 'news',
        name: 'News(Red Folders)',
        options: [
            'no',
            'yes'
        ]
    },
    {
        id: 'mistakes',
        name: 'Mistakes',
        options: [
            'cut winner early',
            'didn\'t follow playbook',
            'fomo entry',
            'oversized'
        ]
    },
    {
        id: 'entry_off',
        name: 'Entry off',
        options: [
            'Too Early',
            'Too Late',
            'Chasing',
            'Perfect',
            'Invalid Setup'
        ]
    },
    {
        id: 'entry_timeframe',
        name: 'Entry TimeFrame',
        options: [
            'M1',
            'M5',
            'M15',
            'M30',
            'H1',
            'H4',
            'D1'
        ]
    },
    {
        id: 'market_conditions',
        name: 'Market Conditions',
        options: [
            'Trending Up',
            'Trending Down',
            'Ranging',
            'Choppy',
            'Volatile',
            'Liquidity Sweep'
        ]
    },
    {
        id: 'mental_state',
        name: 'Mental State',
        options: [
            'Calm',
            'Anxious',
            'Excited',
            'Bored',
            'Revenge Trading',
            'Tilted',
            'Focused'
        ]
    },
    {
        id: 'distractions',
        name: 'Distractions',
        options: [
            'Phone',
            'Family',
            'Work',
            'Noise',
            'Social Media',
            'None'
        ]
    }
];
