import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

const LineChart = ({ data, symbol }) => {
    // This ref connects our React code to the actual HTML <svg> element
    const svgRef = useRef();

    useEffect(() => {
        // Don't draw anything if we don't have data yet
        if (!data || data.length === 0) return;

        // 1. CLEAR THE CANVAS: so it doesn't draw multiple charts on top of each other
        d3.select(svgRef.current).selectAll("*").remove();

        // 2. SETUP DIMENSIONS
        const width = 600;
        const height = 300;
        const margin = { top: 20, right: 30, bottom: 30, left: 50 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        // Connect D3 to our SVG element
        const svg = d3.select(svgRef.current)
            .attr("viewBox", `0 0 ${width} ${height}`) // Makes the chart responsive!
            .style("width", "100%")
            .style("height", "auto")
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // 3. CREATE SCALES (Translates our prices/dates into pixel coordinates)
        const xScale = d3.scaleTime()
            .domain(d3.extent(data, d => d.date)) // From oldest to newest date
            .range([0, innerWidth]);

        const yScale = d3.scaleLinear()
            .domain([d3.min(data, d => d.price) * 0.95, d3.max(data, d => d.price) * 1.05]) // Add a 5% buffer top/bottom
            .range([innerHeight, 0]); // SVG y-axis is inverted (0 is at the top)

        // 4. DRAW AXES
        svg.append("g")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale).ticks(6))
            .attr("color", "#8792a2"); // Style the axis color

        svg.append("g")
            .call(d3.axisLeft(yScale).tickFormat(d => `$${d}`))
            .attr("color", "#8792a2");

        // 5. DRAW THE LINE
        const lineGenerator = d3.line()
            .x(d => xScale(d.date))
            .y(d => yScale(d.price))
            .curve(d3.curveMonotoneX); // Makes the line slightly smooth

        svg.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", "#4f46e5") // A nice indigo color
            .attr("stroke-width", 3)
            .attr("d", lineGenerator);

    }, [data]); // This array tells React to redraw the chart ONLY when 'data' changes

    return (
        <div className="card" style={{ gridColumn: '1 / -1' }}> {/* Spans the full width of the grid */}
            <h3 style={{ marginBottom: '15px', color: '#1a1f36' }}>{symbol} 30-Day History</h3>
            <svg ref={svgRef}></svg>
        </div>
    );
};

export default LineChart;