/** Calculate core portfolio financial metrics. */

export const calculatePortfolioMetrics = (holdings, livePrices) => {
    let totalInvested = 0;
    let currentValue = 0;

    holdings.forEach(holding => {
        // 1. Calculate cost basis
        const investedForHolding = holding.shares * holding.buyPrice;
        totalInvested += investedForHolding;

        // 2. Calculate current value (fallback to buy price if loading)
        const currentPrice = livePrices[holding.ticker] || holding.buyPrice;
        const currentValForHolding = holding.shares * currentPrice;
        currentValue += currentValForHolding;
    });

    // 3. Profit / loss
    const netProfit = currentValue - totalInvested;

    // 4. Percentage return (guard division by zero)
    const netProfitPercent = totalInvested > 0
        ? (netProfit / totalInvested) * 100
        : 0;

    // Format output
    return {
        totalInvested: Number(totalInvested.toFixed(2)),
        currentValue: Number(currentValue.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
        netProfitPercent: Number(netProfitPercent.toFixed(2))
    };
};