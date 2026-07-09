import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

const LineChart = ({ data, symbol }) => {
    const svgRef = useRef();

    useEffect(() => {
        // 1. Clean data
        const cleanData = data.filter(d => 
            d.date instanceof Date && 
            !isNaN(d.date.getTime()) && 
            typeof d.price === 'number' && 
            !isNaN(d.price)
        );
        if (cleanData.length < 2) return;

        // 2. Clear SVG
        d3.select(svgRef.current).selectAll("*").remove();

        // 3. Setup dimensions
        const width = 800;
        const height = 320;
        const margin = { top: 10, right: 20, bottom: 30, left: 55 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        // Bind SVG
        const svg = d3.select(svgRef.current)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .style("width", "100%")
            .style("height", "auto")
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // 4. Scales
        const xScale = d3.scaleTime()
            .domain(d3.extent(cleanData, d => d.date))
            .range([0, innerWidth]);

        const yMin = d3.min(cleanData, d => d.price);
        const yMax = d3.max(cleanData, d => d.price);
        const yScale = d3.scaleLinear()
            .domain([yMin * 0.98, yMax * 1.02]) // Buffer margin
            .range([innerHeight, 0]);

        // 5. Grid lines
        const yGrid = d3.axisLeft(yScale)
            .ticks(5)
            .tickSize(-innerWidth)
            .tickFormat("");

        svg.append("g")
            .attr("class", "chart-grid")
            .call(yGrid)
            .attr("color", "var(--border-light)")
            .style("stroke-dasharray", "4,4")
            .call(g => g.select(".domain").remove());

        // 6. Draw axes
        const xAxis = d3.axisBottom(xScale)
            .ticks(6)
            .tickSize(0)
            .tickPadding(12);

        const yAxis = d3.axisLeft(yScale)
            .ticks(5)
            .tickFormat(d => `$${d}`)
            .tickSize(0)
            .tickPadding(12);

        svg.append("g")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(xAxis)
            .attr("color", "#8792a2")
            .style("font-size", "0.85rem")
            .style("font-family", "Outfit, sans-serif")
            .call(g => g.select(".domain").remove());

        svg.append("g")
            .call(yAxis)
            .attr("color", "#8792a2")
            .style("font-size", "0.85rem")
            .style("font-family", "Outfit, sans-serif")
            .call(g => g.select(".domain").remove());

        // 7. Area gradient
        const gradientId = `chart-area-gradient-${symbol.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const defs = svg.append("defs");
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%");

        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", "#4f46e5")
            .attr("stop-opacity", 0.15);

        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", "#4f46e5")
            .attr("stop-opacity", 0.0);

        // 8. Area path
        const areaGenerator = d3.area()
            .x(d => xScale(d.date))
            .y0(innerHeight)
            .y1(d => yScale(d.price))
            .curve(d3.curveMonotoneX);

        svg.append("path")
            .datum(cleanData)
            .attr("fill", `url(#${gradientId})`)
            .attr("d", areaGenerator);

        // 9. Line path
        const lineGenerator = d3.line()
            .x(d => xScale(d.date))
            .y(d => yScale(d.price))
            .curve(d3.curveMonotoneX);

        svg.append("path")
            .datum(cleanData)
            .attr("fill", "none")
            .attr("stroke", "#4f46e5")
            .attr("stroke-width", 3.5)
            .attr("stroke-linecap", "round")
            .attr("d", lineGenerator);

    }, [data]);

    return (
        <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
            <svg ref={svgRef}></svg>
        </div>
    );
};

export default LineChart;