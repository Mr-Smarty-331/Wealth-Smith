/**
 * Calculates the core financial metrics for the user's portfolio.
 * * @param {Array} holdings - Array of objects: [{ ticker: 'AAPL', shares: 10, buyPrice: 150 }]
 * @param {Object} livePrices - Object mapping tickers to current prices: { 'AAPL': 175.50 }
 * @returns {Object} The calculated portfolio metrics
 */

export const calculatePortfolioMetrics = (holdings, livePrices) => {
    let totalInvested = 0;
    let currentValue = 0;

    holdings.forEach(holding => {
        // 1. Calculate Total Invested (Cost Basis) for this specific holding
        const investedForHolding = holding.shares * holding.buyPrice;
        totalInvested += investedForHolding;

        // 2. Calculate Current Value for this holding
        // If the API hasn't loaded the live price yet, we safely fallback to the buy price
        // to prevent the app from crashing or showing 'NaN' (Not a Number).
        const currentPrice = livePrices[holding.ticker] || holding.buyPrice;
        const currentValForHolding = holding.shares * currentPrice;
        currentValue += currentValForHolding;
    });

    // 3. Calculate Net Profit (or Loss)
    const netProfit = currentValue - totalInvested;

    // 4. Calculate Percentage Return 
    // We use a safety check (totalInvested > 0) to avoid a "Division by Zero" error 
    // if the user's portfolio is completely empty.
    const netProfitPercent = totalInvested > 0
        ? (netProfit / totalInvested) * 100
        : 0;

    // We return everything cleanly formatted to 2 decimal places
    return {
        totalInvested: Number(totalInvested.toFixed(2)),
        currentValue: Number(currentValue.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
        netProfitPercent: Number(netProfitPercent.toFixed(2))
    };
};