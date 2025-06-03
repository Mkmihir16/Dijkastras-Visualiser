import React, { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, RotateCcw, Zap, Settings, Info } from "lucide-react";

const ROWS = 15;
const COLS = 25;
const INITIAL_START = [7, 2];
const INITIAL_END = [7, 22];
const INITIAL_BARRIERS = [
  [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8],
  [5, 15], [6, 15], [7, 15], [8, 15], [9, 15],
  [3, 18], [4, 18], [5, 18], [6, 18], [7, 18], [8, 18], [9, 18], [10, 18], [11, 18]
];

const SPEEDS = { slow: 150, medium: 50, fast: 15 };

const App = () => {
  const [grid, setGrid] = useState([]);
  const [path, setPath] = useState([]);
  const [visitedNodes, setVisitedNodes] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState('medium');
  const [mode, setMode] = useState('wall'); // wall, start, end
  const [isDrawing, setIsDrawing] = useState(false);
  const [start, setStart] = useState([...INITIAL_START]);
  const [end, setEnd] = useState([...INITIAL_END]);
  const [stats, setStats] = useState({ pathLength: 0, nodesVisited: 0, timeElapsed: 0 });
  const timeoutRef = useRef(null);
  const startTimeRef = useRef(null);
  const isRunningRef = useRef(false);

  const initializeGrid = useCallback(() => {
    const initialGrid = Array.from({ length: ROWS }, (_, i) =>
      Array.from({ length: COLS }, (_, j) => ({
        row: i,
        col: j,
        isStart: i === start[0] && j === start[1],
        isEnd: i === end[0] && j === end[1],
        isBarrier: INITIAL_BARRIERS.some(([r, c]) => r === i && c === j),
        distance: Infinity,
        visited: false,
        previous: null,
        isInPath: false,
        animationDelay: 0,
      }))
    );
    return initialGrid;
  }, [start, end]);

  useEffect(() => {
    const grid = initializeGrid();
    setGrid(grid);
    setPath([]);
    setVisitedNodes([]);
    setStats({ pathLength: 0, nodesVisited: 0, timeElapsed: 0 });
  }, [initializeGrid]);

  const sleep = (ms) => new Promise(resolve => {
    timeoutRef.current = setTimeout(resolve, ms);
  });

  const animatedDijkstra = async (startPos, endPos) => {
    startTimeRef.current = Date.now();
    isRunningRef.current = true;
    
    const [sr, sc] = startPos;
    const [er, ec] = endPos;
    
    // Create a working copy of the grid
    const workingGrid = grid.map(row => 
      row.map(node => ({ 
        ...node, 
        visited: false, 
        distance: node.isStart ? 0 : Infinity, 
        previous: null, 
        isInPath: false 
      }))
    );

    const unvisitedNodes = [];
    const visitedOrder = [];
    let animationStep = 0;

    // Initialize unvisited nodes
    for (let row of workingGrid) {
      for (let node of row) {
        if (!node.isBarrier) {
          unvisitedNodes.push(node);
        }
      }
    }

    while (unvisitedNodes.length && isRunningRef.current) {
      // Check if paused
      if (isPaused) {
        await new Promise(resolve => {
          const checkPause = () => {
            if (!isPaused || !isRunningRef.current) resolve();
            else setTimeout(checkPause, 100);
          };
          checkPause();
        });
      }

      if (!isRunningRef.current) break;

      // Sort nodes by distance and get the closest unvisited node
      unvisitedNodes.sort((a, b) => a.distance - b.distance);
      const current = unvisitedNodes.shift();
      
      if (current.distance === Infinity) break; // No more reachable nodes
      
      current.visited = true;
      current.animationDelay = animationStep++;
      visitedOrder.push({ ...current });

      // Update the display
      setVisitedNodes([...visitedOrder]);
      setStats(prev => ({ 
        ...prev, 
        nodesVisited: visitedOrder.length,
        timeElapsed: Date.now() - startTimeRef.current
      }));

      // If we reached the end, break
      if (current.row === er && current.col === ec) {
        break;
      }

      await sleep(SPEEDS[speed]);

      // Update neighbors
      const neighbors = getNeighbors(current, workingGrid);
      for (let neighbor of neighbors) {
        if (!neighbor.visited && !neighbor.isBarrier) {
          const newDistance = current.distance + 1;
          if (newDistance < neighbor.distance) {
            neighbor.distance = newDistance;
            neighbor.previous = current;
          }
        }
      }
    }

    if (!isRunningRef.current) return;

    // Construct and animate the path
    const pathNodes = [];
    let curr = workingGrid[er][ec];
    
    // Only construct path if end is reachable
    if (curr.distance !== Infinity) {
      while (curr !== null) {
        pathNodes.unshift({ row: curr.row, col: curr.col });
        curr = curr.previous;
      }

      // Animate path construction
      for (let i = 0; i < pathNodes.length; i++) {
        if (!isRunningRef.current) break;
        
        const pathSlice = pathNodes.slice(0, i + 1);
        setPath([...pathSlice]);
        await sleep(SPEEDS[speed] * 2);
      }

      setStats(prev => ({ 
        ...prev, 
        pathLength: pathNodes.length,
        timeElapsed: Date.now() - startTimeRef.current
      }));
    } else {
      // No path found
      setStats(prev => ({ 
        ...prev, 
        pathLength: 0,
        timeElapsed: Date.now() - startTimeRef.current
      }));
    }
  };

  const getNeighbors = (node, grid) => {
    const { row, col } = node;
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    const neighbors = [];
    for (let [dr, dc] of directions) {
      const nr = row + dr, nc = col + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        neighbors.push(grid[nr][nc]);
      }
    }
    return neighbors;
  };

  const handleStart = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setIsPaused(false);
    setVisitedNodes([]);
    setPath([]);
    
    await animatedDijkstra(start, end);
    
    isRunningRef.current = false;
    setIsRunning(false);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleReset = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    isRunningRef.current = false;
    setIsRunning(false);
    setIsPaused(false);
    
    const resetGrid = initializeGrid();
    setGrid(resetGrid);
    setPath([]);
    setVisitedNodes([]);
    setStats({ pathLength: 0, nodesVisited: 0, timeElapsed: 0 });
  };

  const handleNodeClick = (row, col) => {
    if (isRunning) return;
    
    setGrid(prevGrid => {
      const newGrid = prevGrid.map(gridRow => [...gridRow]);
      const node = newGrid[row][col];
      
      if (mode === 'wall' && !node.isStart && !node.isEnd) {
        node.isBarrier = !node.isBarrier; // Toggle wall (allows removal)
      } else if (mode === 'start' && !node.isEnd && !node.isBarrier) {
        // Clear previous start
        newGrid.flat().forEach(n => n.isStart = false);
        node.isStart = true;
        setStart([row, col]);
      } else if (mode === 'end' && !node.isStart && !node.isBarrier) {
        // Clear previous end
        newGrid.flat().forEach(n => n.isEnd = false);
        node.isEnd = true;
        setEnd([row, col]);
      }
      
      return newGrid;
    });
  };

  const handleMouseDown = (row, col) => {
    setIsDrawing(true);
    handleNodeClick(row, col);
  };

  const handleMouseEnter = (row, col) => {
    if (isDrawing && mode === 'wall') {
      handleNodeClick(row, col);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const getNodeClasses = (node) => {
    const isVisited = visitedNodes.some(v => v.row === node.row && v.col === node.col);
    const isInPath = path.some(p => p.row === node.row && p.col === node.col);
    
    let classes = "w-6 h-6 border border-gray-300 cursor-pointer transition-all duration-300 transform hover:scale-110 ";
    
    if (node.isStart) {
      classes += "bg-gradient-to-br from-green-400 to-green-600 shadow-lg animate-pulse ";
    } else if (node.isEnd) {
      classes += "bg-gradient-to-br from-red-400 to-red-600 shadow-lg animate-pulse ";
    } else if (node.isBarrier) {
      classes += "bg-gradient-to-br from-gray-700 to-gray-900 shadow-inner ";
    } else if (isInPath && !node.isStart && !node.isEnd) {
      classes += "bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-lg animate-bounce ";
    } else if (isVisited) {
      classes += "bg-gradient-to-br from-blue-200 to-blue-400 shadow-sm ";
    } else {
      classes += "bg-white hover:bg-gray-50 ";
    }
    
    return classes;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Dijkstra's Algorithm Visualizer
          </h1>
          <p className="text-gray-300 text-lg">Watch the shortest path algorithm in action</p>
        </div>

        {/* Controls */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 shadow-2xl border border-white/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleStart}
                disabled={isRunning}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <Play className="w-5 h-5" />
                Start
              </button>
              
              <button
                onClick={handlePause}
                disabled={!isRunning}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-semibold rounded-xl hover:from-yellow-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <Pause className="w-5 h-5" />
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-semibold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <RotateCcw className="w-5 h-5" />
                Reset
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-white" />
                <select
                  value={speed}
                  onChange={(e) => setSpeed(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  <option value="slow" className="text-black">Slow</option>
                  <option value="medium" className="text-black">Medium</option>
                  <option value="fast" className="text-black">Fast</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-white" />
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  <option value="wall" className="text-black">Draw Walls</option>
                  <option value="start" className="text-black">Move Start</option>
                  <option value="end" className="text-black">Move End</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 text-center border border-white/20">
            <div className="text-2xl font-bold text-cyan-400">{stats.pathLength || '-'}</div>
            <div className="text-gray-300 text-sm">Path Length</div>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 text-center border border-white/20">
            <div className="text-2xl font-bold text-purple-400">{stats.nodesVisited}</div>
            <div className="text-gray-300 text-sm">Nodes Visited</div>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 text-center border border-white/20">
            <div className="text-2xl font-bold text-pink-400">{stats.timeElapsed}ms</div>
            <div className="text-gray-300 text-sm">Time Elapsed</div>
          </div>
        </div>

        {/* Grid */}
        <div className="flex justify-center mb-6">
          <div 
            className="inline-block bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-2xl border border-white/20"
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
              {grid.flat().map((node, index) => (
                <div
                  key={index}
                  className={getNodeClasses(node)}
                  onMouseDown={() => handleMouseDown(node.row, node.col)}
                  onMouseEnter={() => handleMouseEnter(node.row, node.col)}
                  style={{
                    animationDelay: `${(visitedNodes.find(v => v.row === node.row && v.col === node.col)?.animationDelay || 0) * 50}ms`
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-2xl border border-white/20">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-green-600 rounded shadow-lg"></div>
              <span className="text-white font-medium">Start</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-red-400 to-red-600 rounded shadow-lg"></div>
              <span className="text-white font-medium">End</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-gray-700 to-gray-900 rounded shadow-lg"></div>
              <span className="text-white font-medium">Wall</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-200 to-blue-400 rounded shadow-lg"></div>
              <span className="text-white font-medium">Visited</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded shadow-lg"></div>
              <span className="text-white font-medium">Path</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 text-center">
          <p className="text-gray-300 text-sm">
            Click and drag to draw/remove walls • Select mode to move start/end points • Watch as Dijkstra finds the shortest path!
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;