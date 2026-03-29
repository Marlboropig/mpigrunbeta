/**
 * Price Utility
 * Fetch live cryptocurrency prices from Jupiter Oracle
 */

export const getSolPriceInUSD = async (): Promise<number> => {
    try {
        const apiKey = process.env.NEXT_PUBLIC_JUPITER_API_KEY || '';
        const res = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112', {
            headers: {
                'x-api-key': apiKey
            }
        });
        const data = await res.json();
        const price = data?.data?.['So11111111111111111111111111111111111111112']?.price;
        return parseFloat(price) || 0;
    } catch (error) {
        console.error('Failed to fetch SOL price:', error);
        // Fallback price if API fails (approximate)
        return 180; 
    }
};

export const usdToSol = (usdAmount: number, solPrice: number): number => {
    if (solPrice <= 0) return 0;
    return usdAmount / solPrice;
};
