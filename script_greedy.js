var infoContainer = document.getElementById('infoContainer');
var svg,pathMatrix,csvFile;
var data = [];
var edges = [];
var colorMap = {};
const maxX = 500;
const maxY = 500;
const width = 550;
const height = 550;
var dist;

dist = parseInt(document.getElementById('distanceInput').value, 10);
csvFile = document.getElementById('csvFileOption').value;
document.querySelector('.settings-container').style.display = 'none';
document.getElementById('allButton').style.display = 'block';
initialSettings();
var button = document.getElementById('allButton');
button.addEventListener('click', distanceColoring);

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
        pathMatrix = calculatePaths(data,edges);
    });
}
function distanceColoring() {
    data.forEach(node => {
        node.col = 0;
    });

    for (var i = 0; i < data.length; i++) {
        var currentNode = data[i];
        var neighbors = data.filter((node, j) => node !== currentNode && pathMatrix[i][j] <= dist);
        var neighborColors = neighbors.map(node => node.col);

        var color = 1;
        while (neighborColors.includes(color)) {
            color++;
        }
        currentNode.col = color;
    }

    svg.selectAll(".point")
        .style("fill", function(d) { return getColor(d.col); });

    updateLastInfo();
}
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
function calculatePaths(data, edges) {
    const adjacencyList = new Array(data.length).fill().map(() => []);
    for (var edge of edges) {
        const { source, target } = edge;
        const sourceIndex = data.findIndex(node => node.vertex === source);
        const targetIndex = data.findIndex(node => node.vertex === target);
        adjacencyList[sourceIndex].push(targetIndex);
        adjacencyList[targetIndex].push(sourceIndex);
    }
    const calculatePathsMatrix = [];
    for (var i = 0; i < data.length; i++) {
        const row = new Array(data.length).fill(Infinity);
        row[i] = 0;
        const queue = [i];
        const visited = new Array(data.length).fill(false);
        visited[i] = true;
        while (queue.length > 0) {
            const currentNode = queue.shift();
            const currentDistance = row[currentNode];
            for (var neighbor of adjacencyList[currentNode]) {
                if (!visited[neighbor]) {
                    row[neighbor] = currentDistance + 1;
                    queue.push(neighbor);
                    visited[neighbor] = true;
                }
            }
        }
        calculatePathsMatrix.push(row);
    }
    return calculatePathsMatrix;
}
function wrongPaths(data, pathMatrix, svg, dist) {
    var count = 0;
    for (var i = 0; i < data.length; i++) {
        for (var j = i + 1; j < data.length; j++) {
            if (data[i].col === data[j].col && pathMatrix[i][j] <= dist) {
                count++;
                const sourceNode = data[i];
                const targetNode = data[j];
                //console.log("Source:", sourceNode, "Target:", targetNode);
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
