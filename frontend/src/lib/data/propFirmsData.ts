export interface PropFirmAccountType {
    size: number
    sizeLabel: string
    price: number
    rules?: {
        profitTarget?: number
        maxLoss?: number | string
        dailyLoss?: number | string
        drawdownType?: string
    }
}

export interface PropFirm {
    name: string
    type: 'Futures' | 'CFD' | 'Both'
    website: string
    accounts: PropFirmAccountType[]
    logoColor?: string
}

export interface DiscountCode {
    firmName: string
    code: string
    amount: string
    description: string
    link?: string
}

export const PROP_FIRMS: PropFirm[] = [
    {
        name: 'Apex Trader Funding',
        type: 'Futures',
        website: 'https://apextraderfunding.com',
        logoColor: 'bg-blue-600',
        accounts: [
            { size: 25000, sizeLabel: '25K', price: 147, rules: { profitTarget: 1500, maxLoss: 1500, drawdownType: 'Trailing' } },
            { size: 50000, sizeLabel: '50K', price: 167, rules: { profitTarget: 3000, maxLoss: 2500, drawdownType: 'Trailing' } },
            { size: 75000, sizeLabel: '75K', price: 187, rules: { profitTarget: 4250, maxLoss: 2750, drawdownType: 'Trailing' } },
            { size: 100000, sizeLabel: '100K', price: 207, rules: { profitTarget: 6000, maxLoss: 3000, drawdownType: 'Trailing' } },
            { size: 150000, sizeLabel: '150K', price: 297, rules: { profitTarget: 9000, maxLoss: 5000, drawdownType: 'Trailing' } },
            { size: 250000, sizeLabel: '250K', price: 517, rules: { profitTarget: 15000, maxLoss: 6500, drawdownType: 'Trailing' } },
            { size: 300000, sizeLabel: '300K', price: 657, rules: { profitTarget: 20000, maxLoss: 7500, drawdownType: 'Trailing' } },
        ]
    },
    {
        name: 'My Funded Futures',
        type: 'Futures',
        website: 'https://myfundedfutures.com',
        logoColor: 'bg-indigo-600',
        accounts: [
            { size: 50000, sizeLabel: '50K Starter', price: 157, rules: { profitTarget: 3000, maxLoss: 2000, drawdownType: 'EOD Trailing' } },
            { size: 100000, sizeLabel: '100K Starter', price: 344, rules: { profitTarget: 6000, maxLoss: 3000, drawdownType: 'EOD Trailing' } },
            { size: 150000, sizeLabel: '150K Starter', price: 518, rules: { profitTarget: 9000, maxLoss: 4500, drawdownType: 'EOD Trailing' } },
            { size: 50000, sizeLabel: '50K Expert', price: 168, rules: { profitTarget: 3000, maxLoss: 2000, drawdownType: 'EOD Trailing' } },
        ]
    },
    {
        name: 'Topstep',
        type: 'Futures',
        website: 'https://topstep.com',
        logoColor: 'bg-yellow-500',
        accounts: [
            { size: 50000, sizeLabel: '50K', price: 165, rules: { profitTarget: 3000, maxLoss: 2000, drawdownType: 'EOD' } },
            { size: 100000, sizeLabel: '100K', price: 325, rules: { profitTarget: 6000, maxLoss: 3000, drawdownType: 'EOD' } },
            { size: 150000, sizeLabel: '150K', price: 375, rules: { profitTarget: 9000, maxLoss: 4500, drawdownType: 'EOD' } },
        ]
    },
    {
        name: 'FundingPips',
        type: 'CFD',
        website: 'https://fundingpips.com',
        logoColor: 'bg-green-600',
        accounts: [
            { size: 5000, sizeLabel: '5K', price: 36, rules: { profitTarget: 400, dailyLoss: 250, maxLoss: 500 } },
            { size: 10000, sizeLabel: '10K', price: 66, rules: { profitTarget: 800, dailyLoss: 500, maxLoss: 1000 } },
            { size: 25000, sizeLabel: '25K', price: 159, rules: { profitTarget: 2000, dailyLoss: 1250, maxLoss: 2500 } },
            { size: 50000, sizeLabel: '50K', price: 269, rules: { profitTarget: 4000, dailyLoss: 2500, maxLoss: 5000 } },
            { size: 100000, sizeLabel: '100K', price: 529, rules: { profitTarget: 8000, dailyLoss: 5000, maxLoss: 10000 } },
        ]
    },
    {
        name: 'Alpha Capital Group',
        type: 'CFD',
        website: 'https://alphacapitalgroup.uk',
        logoColor: 'bg-blue-500',
        accounts: [
            { size: 5000, sizeLabel: '5K', price: 50, rules: { profitTarget: 500, dailyLoss: 250, maxLoss: 500 } },
            { size: 10000, sizeLabel: '10K', price: 90, rules: { profitTarget: 1000, dailyLoss: 500, maxLoss: 1000 } },
            { size: 25000, sizeLabel: '25K', price: 197, rules: { profitTarget: 2500, dailyLoss: 1250, maxLoss: 2500 } },
            { size: 50000, sizeLabel: '50K', price: 297, rules: { profitTarget: 5000, dailyLoss: 2500, maxLoss: 5000 } },
            { size: 100000, sizeLabel: '100K', price: 497, rules: { profitTarget: 10000, dailyLoss: 5000, maxLoss: 10000 } },
        ]
    },
    {
        name: 'Maven Trading',
        type: 'Both',
        website: 'https://maventrading.com',
        logoColor: 'bg-purple-600',
        accounts: [
            { size: 5000, sizeLabel: '5K', price: 55, rules: { profitTarget: 400, dailyLoss: 250, maxLoss: 500 } },
            { size: 10000, sizeLabel: '10K', price: 90, rules: { profitTarget: 800, dailyLoss: 500, maxLoss: 1000 } },
            { size: 20000, sizeLabel: '20K', price: 150, rules: { profitTarget: 1600, dailyLoss: 1000, maxLoss: 2000 } },
            { size: 50000, sizeLabel: '50K', price: 300, rules: { profitTarget: 4000, dailyLoss: 2500, maxLoss: 5000 } },
            { size: 100000, sizeLabel: '100K', price: 550, rules: { profitTarget: 8000, dailyLoss: 5000, maxLoss: 10000 } },
        ]
    }
]

export const DISCOUNTS: DiscountCode[] = [
    {
        firmName: 'Apex Trader Funding',
        code: 'MATCH',
        amount: '80% OFF',
        description: 'Massive discount on all evaluation accounts.',
        link: 'https://apextraderfunding.com'
    },
    {
        firmName: 'My Funded Futures',
        code: 'MATCH',
        amount: '50% OFF',
        description: 'Half price on Starter and Expert accounts.',
        link: 'https://myfundedfutures.com'
    },
    {
        firmName: 'FundingPips',
        code: 'MATCH',
        amount: '20% OFF',
        description: 'Discount on all CFD challenges.',
        link: 'https://fundingpips.com'
    },
    {
        firmName: 'Alpha Capital Group',
        code: 'MATCH',
        amount: '15% OFF',
        description: 'Save on your next challenge.',
        link: 'https://alphacapitalgroup.uk'
    },
    {
        firmName: 'Maven Trading',
        code: 'MATCH',
        amount: '4% OFF',
        description: 'Small savings on checkout.',
        link: 'https://maventrading.com'
    },
    {
        firmName: 'Finotive Funding',
        code: 'MATCH',
        amount: '25% OFF',
        description: 'Significant discount for evaluations.',
        link: 'https://finotivefunding.com'
    }
]
