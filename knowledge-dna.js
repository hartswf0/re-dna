class KnowledgeDNA {
    constructor() {
        this.width = document.getElementById('dna-viz').clientWidth;
        this.height = document.getElementById('dna-viz').clientHeight;
        this.svg = d3.select('#dna-viz')
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height);
        
        this.nodes = [];
        this.links = [];
        this.simulation = null;
        this.selectedNodes = new Set();
        
        this.initializeSimulation();
    }

    initializeSimulation() {
        this.simulation = d3.forceSimulation(this.nodes)
            .force('link', d3.forceLink(this.links).id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(40))
            .on('tick', () => this.updateVisualization());
    }

    updateVisualization() {
        // Update links with curved paths
        const links = this.svg.selectAll('.link')
            .data(this.links)
            .join('path')
            .attr('class', 'link')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 2)
            .attr('fill', 'none')
            .attr('d', d => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const dr = Math.sqrt(dx * dx + dy * dy);
                return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
            });

        // Update nodes
        const nodes = this.svg.selectAll('.node')
            .data(this.nodes)
            .join('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .call(this.drag());

        // Node circles with gradient fill
        const defs = this.svg.append('defs');
        this.nodes.forEach(node => {
            const gradientId = `gradient-${node.id}`;
            const gradient = defs.append('radialGradient')
                .attr('id', gradientId)
                .attr('cx', '30%')
                .attr('cy', '30%');

            gradient.append('stop')
                .attr('offset', '0%')
                .attr('stop-color', '#fff');

            gradient.append('stop')
                .attr('offset', '100%')
                .attr('stop-color', this.getNodeColor(node));
        });

        // Node circles
        nodes.selectAll('circle')
            .data(d => [d])
            .join('circle')
            .attr('r', 30)
            .attr('fill', d => `url(#gradient-${d.id})`)
            .attr('stroke', d => this.selectedNodes.has(d.id) ? '#4f46e5' : '#fff')
            .attr('stroke-width', 3);

        // Node labels
        nodes.selectAll('.node-label')
            .data(d => [d])
            .join('text')
            .attr('class', 'node-label')
            .attr('text-anchor', 'middle')
            .attr('dy', '.3em')
            .attr('fill', '#000')
            .attr('font-size', '12px')
            .text(d => d.label);

        // Category labels
        nodes.selectAll('.category-label')
            .data(d => [d])
            .join('text')
            .attr('class', 'category-label')
            .attr('text-anchor', 'middle')
            .attr('dy', '2em')
            .attr('fill', '#666')
            .attr('font-size', '10px')
            .text(d => d.category);
    }

    getNodeColor(node) {
        const categoryColors = {
            research: '#22c55e',
            technical: '#3b82f6',
            knowledge_management: '#f59e0b',
            transcription: '#ec4899'
        };
        return node.state === 'sleeping' ? '#94a3b8' : (categoryColors[node.category] || '#6366f1');
    }

    drag() {
        return d3.drag()
            .on('start', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });
    }

    addNode(data) {
        const node = {
            id: data.id,
            label: data.title.split(' ')[0],
            category: data.category,
            state: 'awake',
            data: data
        };
        this.nodes.push(node);
        this.simulation.nodes(this.nodes);
        this.simulation.alpha(1).restart();
    }

    addLink(source, target) {
        const link = { source: source.id, target: target.id };
        this.links.push(link);
        this.simulation.force('link').links(this.links);
        this.simulation.alpha(1).restart();
    }

    toggleNodeState(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            node.state = node.state === 'awake' ? 'sleeping' : 'awake';
            this.updateVisualization();
        }
    }

    selectNode(nodeId) {
        if (this.selectedNodes.has(nodeId)) {
            this.selectedNodes.delete(nodeId);
        } else {
            this.selectedNodes.add(nodeId);
        }
        this.updateVisualization();
    }

    evolveNode(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.state === 'awake') {
            // Create evolved version
            const evolvedNode = {
                id: `${nodeId}_evolved`,
                label: `${node.label}+`,
                category: node.category,
                state: 'awake',
                data: { ...node.data, evolved: true }
            };
            this.nodes.push(evolvedNode);
            this.addLink(node, evolvedNode);
            this.simulation.alpha(1).restart();
        }
    }

    combineNodes(nodeIds) {
        if (nodeIds.length < 2) return;
        
        const nodes = nodeIds.map(id => this.nodes.find(n => n.id === id))
            .filter(n => n && n.state === 'awake');
        
        if (nodes.length < 2) return;

        // Create combined node
        const combinedNode = {
            id: `combined_${Date.now()}`,
            label: nodes.map(n => n.label.charAt(0)).join(''),
            category: nodes[0].category,
            state: 'awake',
            data: {
                title: `Combined: ${nodes.map(n => n.data.title).join(' + ')}`,
                parents: nodes.map(n => n.id)
            }
        };

        this.nodes.push(combinedNode);
        nodes.forEach(node => this.addLink(node, combinedNode));
        this.simulation.alpha(1).restart();
    }

    filterByCategory(category) {
        this.svg.selectAll('.node')
            .style('opacity', d => category === 'all' || d.category === category ? 1 : 0.3);
        
        this.svg.selectAll('.link')
            .style('opacity', d => {
                const sourceVisible = category === 'all' || d.source.category === category;
                const targetVisible = category === 'all' || d.target.category === category;
                return sourceVisible && targetVisible ? 0.6 : 0.1;
            });
    }
}
