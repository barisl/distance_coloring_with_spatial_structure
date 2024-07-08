var infoContainer = document.getElementById('infoContainer');
var svg,pathMatrix,csvFile,button,dist;
var data = [];
var edges = [];
var colorMap = {};
const maxX = 500;
const maxY = 500;
const width = 550;
const height = 550;

// Initialize distance and CSV file based on user input
dist = parseInt(document.getElementById('distanceInput').value, 10);
csvFile = document.getElementById('csvFileOption').value;
document.querySelector('.settings-container').style.display = 'none';
document.getElementById('allButton').style.display = 'block';
initialSettings();
button = document.getElementById('allButton');
button.addEventListener('click', distanceColoring);

// Function to initialize the settings and load the CSV data.
function initialSettings() {
    d3.csv(csvFile, function(csvData) {
        let isSourceTarget = false;
        csvData.forEach(function(d) {
            if(!isSourceTarget) {
                if(d.vertex === "source"){
                    isSourceTarget = true;
                } else {
                    data.push({vertex: d.vertex, x: +d.x, y: +d.y});
                }
            } else {
                edges.push({ source: d.vertex, target: d.x });
            }
        });
        // Normalize the coordinates to fit within the maxX and maxY dimensions
        let min_x = d3.min(data.map(d => d.x));
        let min_y = d3.min(data.map(d => d.y));
        let max_x = d3.max(data.map(d => d.x));
        let max_y = d3.max(data.map(d => d.y));

        data.forEach(d => {
            d.x = (d.x - min_x) / (max_x - min_x) * maxX;
            d.y = (d.y - min_y) / (max_y - min_y) * maxY;
        });

        svg = d3.select("#svg-container")
            .attr("width", width)
            .attr("height", height)
            .append("g");

        edges.forEach(function(edge) {
            var sourceNode = data.find(function(node) { return node.vertex === edge.source; });
            var targetNode = data.find(function(node) { return node.vertex === edge.target; });
            if (sourceNode && targetNode) {
                svg.append("line")
                    .attr("class", "edge")
                    .attr("x1", sourceNode.x)
                    .attr("y1", sourceNode.y)
                    .attr("x2", targetNode.x)
                    .attr("y2", targetNode.y);
            }
        });
        svg.selectAll(".point")
            .data(data)
            .enter().append("circle")
            .attr("class","point")
            .attr("cx", function (d) {return d.x;})
            .attr("cy", function (d) {return d.y;})
            .attr("r", 3);
        pathMatrix = calculatePaths(data, edges, dist);
    });
}
// Function to perform the distance coloring algorithm
function distanceColoring() {
    // initialize color for each vertex
    data.forEach(node => {
        node.col = 0;
    });
    const adjacencyList = calculateAdjacencyList(data,edges);
    // Helper function to find neighbors within the distance limit
    function getNeighbors(nodeIndex) {
        const neighbors = new Set();
        const queue = [{ node: nodeIndex, depth: 0 }];
        const visited = new Set();
        visited.add(nodeIndex);

        while (queue.length > 0) {
            const { node: currentNode, depth } = queue.shift();
            if (depth >= dist) continue;

            adjacencyList[currentNode].forEach(neighbor => {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push({ node: neighbor, depth: depth + 1 });
                    neighbors.add(neighbor);
                }
            });
        }
        return neighbors;
    }
    // find the neighbor color
    data.forEach((node, index) => {
        const neighbors = getNeighbors(index);
        const usedColors = new Set();
        neighbors.forEach(neighbor => {
            const neighbor_col = data[neighbor].col;
            if (neighbor_col > 0) {
                usedColors.add(neighbor_col);
            }
        });
        // Determine the smallest available color that is not used by neighbors
        var minAvailableColor = 1;
        while (usedColors.has(minAvailableColor)) {
            minAvailableColor++;
        }
        node.col = minAvailableColor;
    });
    svg.selectAll(".point")
        .style("fill", d => getColor(d.col));
    button.remove();
    updateLastInfo();
}
// Function to generate a color for each color index
function getColor(col) {
    if (colorMap[col]) {
        return colorMap[col];
    } else {
        var letters = '0123456789ABCDEF';
        var color = '#';
        for (var i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        colorMap[col] = color;
        return color;
    }
}
function updateLastInfo() {
    var distinctColors = new Set(data.map(node => node.col));
    infoContainer.innerHTML = `
        <p>d = ${dist}</p>
        <p>k = ${distinctColors.size}</p>
        <p>p = ${wrongPaths(data, pathMatrix, svg, dist)}</p>
    `;
}
// Function to calculate the adjacency list for the graph
function calculateAdjacencyList(data,edges){
    const adjacencyList = new Array(data.length).fill().map(() => []);
    for (var edge of edges) {
        const { source, target } = edge;
        const sourceIndex = data.findIndex(node => node.vertex === source);
        const targetIndex = data.findIndex(node => node.vertex === target);
        adjacencyList[sourceIndex].push(targetIndex);
        adjacencyList[targetIndex].push(sourceIndex);
    }
    return adjacencyList;
}
// Function to compute the shortest paths matrix for all pairs of nodes
function calculatePaths(data, edges, dist) {
    const adjacencyList = calculateAdjacencyList(data,edges);
    const pathMatrix = Array.from({ length: data.length }, () => Array(data.length).fill(Infinity));
    for (var i = 0; i < data.length; i++) {
        pathMatrix[i][i] = 0;
        const queue = [{ node: i, depth: 0 }];
        while (queue.length > 0) {
            const { node: currentNode, depth } = queue.shift();
            if (depth >= dist) continue;
            for (var neighbor of adjacencyList[currentNode]) {
                if (pathMatrix[i][neighbor] > depth + 1) {
                    pathMatrix[i][neighbor] = depth + 1;
                    queue.push({ node: neighbor, depth: depth + 1 });
                }
            }
        }
    }
    return pathMatrix;
}
// Function to count and highlight incorrect paths that violate the distance constraint
function wrongPaths(data, pathMatrix, svg, dist) {
    var count = 0;
    for (var i = 0; i < data.length; i++) {
        for (var j = i + 1; j < data.length; j++) {
            if (data[i].col === data[j].col && pathMatrix[i][j] <= dist) {
                count++;
                const sourceNode = data[i];
                const targetNode = data[j];
                svg.append("line")
                    .attr("class", "wrong-path")
                    .attr("x1", sourceNode.x)
                    .attr("y1", sourceNode.y)
                    .attr("x2", targetNode.x)
                    .attr("y2", targetNode.y);
                svg.append("circle")
                    .attr("class", "point")
                    .attr("cx", sourceNode.x)
                    .attr("cy", sourceNode.y)
                    .attr("r", 3)
                    .style("fill", getColor(sourceNode.col));
                svg.append("circle")
                    .attr("class", "point")
                    .attr("cx", targetNode.x)
                    .attr("cy", targetNode.y)
                    .attr("r", 3)
                    .style("fill", getColor(targetNode.col));
            }
        }
    }
    return count;
}
