class KnowledgeInterface {
    constructor() {
        this.documents = [];
        this.playlist = [];
        this.currentCategory = 'all';
        this.searchTerm = '';
        this.isVisualizationView = false;
        this.isSidebarVisible = false;
        this.documentTemplate = document.getElementById('document-template');
        this.categories = {};

        this.initializeElements();
        this.setupEventListeners();
        this.loadDocuments();
        this.loadPlaylist();
    }

    initializeElements() {
        this.searchInput = document.getElementById('search-input');
        this.knowledgeList = document.getElementById('knowledge-list');
        this.contentDisplay = document.getElementById('content-display');
        this.totalDocsElement = document.getElementById('total-docs');
        this.playlistCountElement = document.getElementById('playlist-count');
        this.mobileMenuButton = document.getElementById('mobile-menu');
        this.viewToggleButton = document.getElementById('view-toggle');
        this.helixContainer = document.getElementById('helix-visualization');
        this.playlistItems = document.getElementById('playlist-items');
        this.exportPlaylistButton = document.getElementById('export-playlist');
        this.clearPlaylistButton = document.getElementById('clear-playlist');
    }

    setupEventListeners() {
        this.searchInput.addEventListener('input', () => this.handleSearch());
        
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentCategory = btn.dataset.category;
                this.filterDocuments();
            });
        });

        this.mobileMenuButton.addEventListener('click', () => {
            document.body.classList.toggle('show-sidebar');
            this.isSidebarVisible = !this.isSidebarVisible;
        });

        this.viewToggleButton.addEventListener('click', () => {
            this.isVisualizationView = !this.isVisualizationView;
            document.body.classList.toggle('show-visualization', this.isVisualizationView);
            if (this.isVisualizationView) {
                this.renderDNAVisualization();
            }
        });

        this.exportPlaylistButton.addEventListener('click', () => this.exportPlaylist());
        this.clearPlaylistButton.addEventListener('click', () => this.clearPlaylist());

        window.addEventListener('resize', () => {
            if (this.isVisualizationView) {
                this.renderDNAVisualization();
            }
        });
    }

    async loadDocuments() {
        try {
            console.log('Starting to load documents...');
            const documents = [];
            // Load all chunks from the repository
            for (let i = 1; i <= 7; i++) {
                const chunkNum = String(i).padStart(3, '0');
                try {
                    const url = `data/chunk_${chunkNum}/chunk_${chunkNum}_successful.json`;
                    console.log(`Attempting to load: ${url}`);
                    const response = await fetch(url);
                    if (!response.ok) {
                        console.warn(`Chunk ${chunkNum} not found or failed to load. Status: ${response.status}`);
                        continue;
                    }
                    const chunkData = await response.json();
                    console.log(`Loaded chunk ${chunkNum}:`, chunkData);
                    if (Array.isArray(chunkData)) {
                        documents.push(...chunkData);
                    } else if (chunkData.documents) {
                        documents.push(...chunkData.documents);
                    }
                } catch (error) {
                    console.warn(`Error loading chunk ${chunkNum}:`, error);
                }
            }
            
            console.log(`Total documents loaded: ${documents.length}`);
            
            // Process and standardize the document format
            this.documents = documents.map(doc => ({
                id: doc.id || doc.url,
                title: doc.title || 'Untitled',
                category: doc.category || this.determineCategory(doc.content?.text || '', doc.title || ''),
                text: doc.content?.text || '',
                content: doc.content || {},
                connections: doc.connections || [],
                tags: doc.tags || []
            }));
            
            console.log(`Processed ${this.documents.length} documents`);
            this.totalDocsElement.textContent = this.documents.length;
            this.filterDocuments();
        } catch (error) {
            console.error('Error loading documents:', error);
            this.contentDisplay.innerHTML = '<div class="error">Error loading documents. Please try again later.</div>';
        }
    }

    loadPlaylist() {
        const savedPlaylist = localStorage.getItem('knowledge_playlist');
        if (savedPlaylist) {
            this.playlist = JSON.parse(savedPlaylist);
            this.updatePlaylistUI();
        }
    }

    savePlaylist() {
        localStorage.setItem('knowledge_playlist', JSON.stringify(this.playlist));
        this.updatePlaylistUI();
    }

    updatePlaylistUI() {
        this.playlistCountElement.textContent = this.playlist.length;
        this.playlistItems.innerHTML = this.playlist.map(item => `
            <div class="playlist-item">
                <div class="title">${item.title || 'Untitled'}</div>
                <div class="tags">
                    ${item.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
        `).join('');
    }

    addToPlaylist(doc) {
        if (!this.playlist.find(item => item.id === doc.id)) {
            this.playlist.push({
                id: doc.id,
                title: doc.title,
                url: doc.url,
                category: doc.category,
                tags: doc.tags || []
            });
            this.savePlaylist();
        }
    }

    exportPlaylist() {
        const playlistData = {
            created_at: new Date().toISOString(),
            items: this.playlist.map(item => ({
                title: item.title,
                url: item.url,
                category: item.category,
                tags: item.tags
            }))
        };

        const blob = new Blob([JSON.stringify(playlistData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'knowledge_playlist.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    clearPlaylist() {
        this.playlist = [];
        this.savePlaylist();
    }

    addTag(doc, tag) {
        if (!doc.tags) doc.tags = [];
        if (!doc.tags.includes(tag)) {
            doc.tags.push(tag);
            if (this.playlist.find(item => item.id === doc.id)) {
                this.savePlaylist();
            }
        }
    }

    renderDNAVisualization() {
        const dnaVisualizer = new DNAVisualizer(this.helixContainer);
        dnaVisualizer.documents = this.documents;
        dnaVisualizer.currentCategory = this.currentCategory;
        dnaVisualizer.render();
    }

    showDocumentPreview(doc, element) {
        const preview = document.createElement('div');
        preview.className = 'document-preview';
        preview.innerHTML = `
            <h3>${doc.title || 'Untitled'}</h3>
            <p class="category">${doc.category}</p>
            <p class="preview-text">${this.formatPreviewText(doc.text)}</p>
        `;
        
        const rect = element.getBoundingClientRect();
        preview.style.left = `${rect.right + 10}px`;
        preview.style.top = `${rect.top}px`;
        
        this.helixContainer.appendChild(preview);
    }

    hideDocumentPreview() {
        const preview = this.helixContainer.querySelector('.document-preview');
        if (preview) {
            preview.remove();
        }
    }

    updateSelectionControls() {
        const hasSelection = this.helixContainer.querySelector('.sequence-block.selected') !== null;
        this.helixContainer.querySelector('.add-to-playlist').disabled = !hasSelection;
    }

    setupResponsiveLayout(container) {
        const resizeObserver = new ResizeObserver(() => {
            const width = container.clientWidth;
            const blocks = container.querySelectorAll('.sequence-block');
            const blockWidth = Math.max(2, Math.min(4, width / blocks.length));
            
            blocks.forEach(block => {
                block.style.width = `${blockWidth}px`;
            });
        });
        resizeObserver.observe(container);
    }

    getCategoryColor(category) {
        const colors = {
            research: '#ff3e9d',
            technical: '#4caf50',
            default: '#2196f3'
        };
        return colors[category] || colors.default;
    }

    handleBlockHover(doc, block) {
        block.classList.add('active');
        this.showDocumentPreview(doc, block);
        // Highlight related blocks
        const relatedBlocks = this.helixContainer.querySelectorAll(
            `.sequence-block[data-id="${doc.id}"]`
        );
        relatedBlocks.forEach(b => b.classList.add('related'));
    }

    handleBlockUnhover(block) {
        block.classList.remove('active');
        this.hideDocumentPreview();
        // Remove highlights
        this.helixContainer.querySelectorAll('.sequence-block.related')
            .forEach(b => b.classList.remove('related'));
    }

    handleBlockClick(doc) {
        this.displayDocument(doc);
        // Add visual feedback
        const blocks = this.helixContainer.querySelectorAll(
            `.sequence-block[data-id="${doc.id}"]`
        );
        blocks.forEach(b => {
            b.classList.add('selected');
            setTimeout(() => b.classList.remove('selected'), 1000);
        });
    }

    handleEvolution(action, documents) {
        switch (action) {
            case 'create':
                // Implement strand creation
                break;
            case 'mutate':
                this.mutateStrand(documents);
                break;
            case 'combine':
                // Implement strand combination
                break;
            case 'save':
                // Implement evolution saving
                break;
        }
    }

    mutateStrand(documents) {
        const sequences = this.helixContainer.querySelectorAll('.sequence');
        sequences.forEach(sequence => {
            const blocks = sequence.querySelectorAll('.sequence-block');
            blocks.forEach(block => {
                block.classList.add('mutating');
                setTimeout(() => block.classList.remove('mutating'), 1000);
            });
        });
    }

    updateVisualizationLayout() {
        // Update layout on container resize
        const container = this.helixContainer.querySelector('.dna-container');
        const width = container.clientWidth;
        const sequences = container.querySelectorAll('.sequence');
        
        sequences.forEach(sequence => {
            const blocks = sequence.querySelectorAll('.sequence-block');
            const blockWidth = Math.max(4, Math.min(8, width / blocks.length));
            const blockSpacing = blockWidth + 1;
            
            blocks.forEach((block, i) => {
                block.style.left = `${i * blockSpacing}px`;
                block.style.width = `${blockWidth}px`;
            });
        });
    }

    determineCategory(text, title) {
        const lowerText = text.toLowerCase();
        const lowerTitle = title.toLowerCase();
        
        if (lowerText.includes('transcription') || lowerTitle.includes('transcription')) {
            return 'transcription';
        } else if (lowerText.includes('knowledge management') || lowerTitle.includes('knowledge management')) {
            return 'knowledge_management';
        } else if (lowerText.includes('technical') || lowerTitle.includes('technical') || 
                   lowerText.includes('software') || lowerText.includes('programming')) {
            return 'technical';
        }
        return 'research';
    }

    extractTextFromHTML(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        // Remove script and style elements
        const scripts = temp.getElementsByTagName('script');
        const styles = temp.getElementsByTagName('style');
        while (scripts[0]) scripts[0].parentNode.removeChild(scripts[0]);
        while (styles[0]) styles[0].parentNode.removeChild(styles[0]);
        
        return temp.textContent || temp.innerText || '';
    }

    handleSearch() {
        this.searchTerm = this.searchInput.value.toLowerCase();
        this.filterDocuments();
    }

    filterDocuments() {
        const filtered = this.documents.filter(doc => {
            const matchesCategory = this.currentCategory === 'all' || doc.category === this.currentCategory;
            const matchesSearch = !this.searchTerm || 
                doc.title?.toLowerCase().includes(this.searchTerm) ||
                doc.text?.toLowerCase().includes(this.searchTerm);
            return matchesCategory && matchesSearch;
        });

        this.renderDocumentList(filtered);
        if (this.isVisualizationView) {
            this.renderDNAVisualization();
        }
    }

    renderDocumentList(documents) {
        this.knowledgeList.innerHTML = documents.map(doc => `
            <div class="knowledge-item" data-id="${doc.id}">
                <h3>${doc.title || 'Untitled'}</h3>
                <div class="meta">
                    <span>${doc.category}</span>
                    ${doc.author ? `<span>by ${doc.author}</span>` : ''}
                </div>
            </div>
        `).join('');

        this.knowledgeList.querySelectorAll('.knowledge-item').forEach(item => {
            item.addEventListener('click', () => {
                const doc = documents.find(d => d.id === item.dataset.id);
                this.displayDocument(doc);
                
                if (window.innerWidth <= 768) {
                    document.body.classList.remove('show-sidebar');
                }
            });
        });
    }

    formatContent(text) {
        if (!text) return '';
        return text.split('\n')
            .filter(p => p.trim())
            .map(p => `<p>${p.trim()}</p>`)
            .join('');
    }

    displayDocument(doc) {
        const template = this.documentTemplate.content.cloneNode(true);
        
        // Set source link
        const sourceLink = template.querySelector('.source-link');
        if (doc.url) {
            sourceLink.href = doc.url;
        } else {
            sourceLink.style.display = 'none';
        }
        
        // Set title and meta
        template.querySelector('h2').textContent = doc.title || 'Untitled';
        template.querySelector('.meta').innerHTML = `
            <span>Category: ${doc.category}</span>
            ${doc.author ? `<span>Author: ${doc.author}</span>` : ''}
            ${doc.published_date ? `<span>Date: ${new Date(doc.published_date).toLocaleDateString()}</span>` : ''}
        `;
        
        // Set content
        template.querySelector('.content-body').innerHTML = this.formatContent(doc.content);
        
        // Setup tag input
        const tagInput = template.querySelector('.tag-input');
        const tagContainer = template.querySelector('.tags');
        
        const updateTags = () => {
            tagContainer.innerHTML = (doc.tags || [])
                .map(tag => `<span class="tag">${tag}</span>`)
                .join('');
        };
        
        tagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                this.addTag(doc, e.target.value.trim());
                e.target.value = '';
                updateTags();
            }
        });
        
        updateTags();
        
        // Setup playlist button
        const playlistButton = template.querySelector('.add-to-playlist');
        playlistButton.addEventListener('click', () => {
            this.addToPlaylist(doc);
            playlistButton.textContent = 'Added to Playlist';
            playlistButton.disabled = true;
        });
        
        if (this.playlist.find(item => item.id === doc.id)) {
            playlistButton.textContent = 'Added to Playlist';
            playlistButton.disabled = true;
        }
        
        this.contentDisplay.innerHTML = '';
        this.contentDisplay.appendChild(template);
        
        // Update selection in list
        this.knowledgeList.querySelectorAll('.knowledge-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.id === doc.id);
        });
        
        if (window.innerWidth <= 768) {
            document.body.classList.remove('show-sidebar');
        }
    }
}

class DNAVisualizer {
    constructor(container) {
        this.container = container;
        this.documents = [];
        this.currentCategory = 'all';
        this.activeStates = new Set();
        this.zoomLevel = 1;
        this.viewportStart = 0;
        this.sequencesPerLane = 25;
        this.init();
    }

    async init() {
        // Get documents from the main interface
        const mainInterface = document.querySelector('.knowledge-list');
        if (mainInterface) {
            const items = Array.from(mainInterface.querySelectorAll('.knowledge-item'));
            this.documents = items.map(item => ({
                id: item.getAttribute('data-id'),
                title: item.querySelector('.title').textContent,
                category: item.getAttribute('data-category'),
                text: item.querySelector('.preview').textContent,
                connections: JSON.parse(item.getAttribute('data-connections') || '[]')
            }));
        }
        this.render();
    }

    render() {
        const container = this.container;
        container.innerHTML = '';
        container.setAttribute('role', 'application');
        container.setAttribute('aria-label', 'DNA Sequence Visualization');

        // Create layout structure
        const layout = document.createElement('div');
        layout.className = 'dna-layout';
        
        // Add intensity sidebar
        const sidebar = this.createIntensitySidebar();
        layout.appendChild(sidebar);
        
        // Create main sequence view
        const sequenceView = this.createSequenceView();
        layout.appendChild(sequenceView);
        
        // Add header with markers
        const header = this.createSequenceHeader();
        sequenceView.insertBefore(header, sequenceView.firstChild);
        
        container.appendChild(layout);
        
        // Add controls
        const controls = this.createControls();
        container.appendChild(controls);
        
        this.initializeInteractions();
    }

    createIntensitySidebar() {
        const sidebar = document.createElement('div');
        sidebar.className = 'intensity-sidebar';
        sidebar.setAttribute('role', 'complementary');
        sidebar.setAttribute('aria-label', 'Sequence Intensity Graphs');
        
        // Create intensity traces
        for (let i = 0; i < 4; i++) {
            const trace = document.createElement('div');
            trace.className = 'intensity-trace';
            trace.setAttribute('data-nucleotide', ['A', 'T', 'C', 'G'][i]);
            trace.setAttribute('role', 'img');
            trace.setAttribute('aria-label', `Intensity trace for ${['Adenine', 'Thymine', 'Cytosine', 'Guanine'][i]}`);
            
            // Generate trace data
            const data = this.generateIntensityData();
            this.drawIntensityTrace(trace, data);
            
            sidebar.appendChild(trace);
        }
        
        return sidebar;
    }

    createSequenceView() {
        const view = document.createElement('div');
        view.className = 'sequence-view';
        view.setAttribute('role', 'main');
        
        // Create lanes
        const numLanes = Math.ceil(this.documents.length / this.sequencesPerLane);
        for (let i = 0; i < numLanes; i++) {
            const lane = document.createElement('div');
            lane.className = 'sequence-lane';
            lane.setAttribute('role', 'row');
            lane.setAttribute('aria-label', `Sequence lane ${i + 1}`);
            
            // Add sequence blocks
            const start = i * this.sequencesPerLane;
            const end = Math.min(start + this.sequencesPerLane, this.documents.length);
            
            for (let j = start; j < end; j++) {
                const doc = this.documents[j];
                const block = this.createSequenceBlock(doc, j);
                lane.appendChild(block);
            }
            
            view.appendChild(lane);
        }
        
        return view;
    }

    createSequenceHeader() {
        const header = document.createElement('div');
        header.className = 'sequence-header';
        header.setAttribute('role', 'rowheader');
        
        // Add marker numbers
        for (let i = 1; i <= 26; i++) {
            const marker = document.createElement('div');
            marker.className = 'sequence-marker';
            marker.textContent = i;
            marker.setAttribute('role', 'columnheader');
            header.appendChild(marker);
        }
        
        return header;
    }

    createSequenceBlock(doc, position) {
        const block = document.createElement('div');
        block.className = 'sequence-block';
        block.setAttribute('data-id', doc.id);
        block.setAttribute('data-position', position);
        block.setAttribute('role', 'gridcell');
        
        // Determine nucleotide type and color based on document properties
        const nucleotide = this.determineNucleotide(doc);
        block.classList.add(`nucleotide-${nucleotide}`);
        
        // Set intensity based on document properties
        const intensity = this.calculateIntensity(doc);
        block.style.opacity = intensity;
        
        // Add accessibility attributes
        block.setAttribute('aria-label', `${nucleotide} at position ${position + 1}, intensity ${Math.round(intensity * 100)}%`);
        
        return block;
    }

    determineNucleotide(doc) {
        // Map document categories to nucleotides
        const categoryMap = {
            research: 'A',
            technical: 'T',
            knowledge_management: 'C',
            transcription: 'G'
        };
        return categoryMap[doc.category] || 'N';
    }

    calculateIntensity(doc) {
        // Calculate intensity based on document properties
        let intensity = 0.5; // Base intensity
        
        if (doc.connections && doc.connections.length > 0) {
            intensity += 0.1 * doc.connections.length;
        }
        
        if (doc.lastAccessed) {
            const daysSinceAccess = (Date.now() - new Date(doc.lastAccessed)) / (1000 * 60 * 60 * 24);
            intensity += Math.max(0, 0.3 * (1 - daysSinceAccess / 30));
        }
        
        return Math.min(1, Math.max(0.2, intensity));
    }

    generateIntensityData() {
        // Generate mock intensity data
        return Array.from({ length: 100 }, () => Math.random());
    }

    drawIntensityTrace(element, data) {
        // Create SVG for intensity trace
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 100 30');
        svg.style.width = '100%';
        svg.style.height = '100%';
        
        // Create path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const d = data.reduce((acc, val, i) => {
            const x = i;
            const y = 30 - (val * 25);
            return acc + (i === 0 ? 'M' : 'L') + `${x},${y}`;
        }, '');
        
        path.setAttribute('d', d);
        path.setAttribute('stroke', getComputedStyle(element).getPropertyValue('--trace-color'));
        path.setAttribute('fill', 'none');
        
        svg.appendChild(path);
        element.appendChild(svg);
    }

    createControls() {
        const controls = document.createElement('div');
        controls.className = 'sequence-controls';
        controls.setAttribute('role', 'toolbar');
        
        // Add zoom controls
        const zoomControls = document.createElement('div');
        zoomControls.className = 'zoom-controls';
        
        ['Zoom In', 'Zoom Out', 'Reset Zoom'].forEach(label => {
            const button = document.createElement('button');
            button.textContent = label;
            button.setAttribute('aria-label', label);
            zoomControls.appendChild(button);
        });
        
        controls.appendChild(zoomControls);
        
        // Add navigation controls
        const navControls = document.createElement('div');
        navControls.className = 'navigation-controls';
        
        ['Previous', 'Next'].forEach(label => {
            const button = document.createElement('button');
            button.textContent = label;
            button.setAttribute('aria-label', `${label} sequence set`);
            navControls.appendChild(button);
        });
        
        controls.appendChild(navControls);
        
        return controls;
    }

    initializeInteractions() {
        // Add keyboard navigation
        this.container.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowRight':
                    this.navigate(1);
                    break;
                case 'ArrowLeft':
                    this.navigate(-1);
                    break;
                case '+':
                    this.zoom(1);
                    break;
                case '-':
                    this.zoom(-1);
                    break;
            }
        });
        
        // Add click handlers for controls
        const controls = this.container.querySelector('.sequence-controls');
        if (controls) {
            controls.addEventListener('click', (e) => {
                if (e.target.matches('button')) {
                    const action = e.target.textContent.toLowerCase();
                    if (action.includes('zoom')) {
                        this.zoom(action.includes('in') ? 1 : action.includes('out') ? -1 : 0);
                    } else if (action.includes('previous') || action.includes('next')) {
                        this.navigate(action.includes('next') ? 1 : -1);
                    }
                }
            });
        }
        
        // Add hover interactions for sequence blocks
        const blocks = this.container.querySelectorAll('.sequence-block');
        blocks.forEach(block => {
            block.addEventListener('mouseenter', () => this.showSequenceInfo(block));
            block.addEventListener('mouseleave', () => this.hideSequenceInfo());
        });
    }

    navigate(direction) {
        this.viewportStart = Math.max(0, this.viewportStart + direction * this.sequencesPerLane);
        this.render();
    }

    zoom(delta) {
        this.zoomLevel = Math.max(0.5, Math.min(4, this.zoomLevel + delta * 0.25));
        this.container.style.setProperty('--zoom-level', this.zoomLevel);
    }

    showSequenceInfo(block) {
        const docId = block.getAttribute('data-id');
        const doc = this.documents.find(d => d.id === docId);
        if (!doc) return;
        
        const info = document.createElement('div');
        info.className = 'sequence-info';
        info.innerHTML = `
            <h3>${doc.title}</h3>
            <p>Category: ${doc.category}</p>
            <p>Position: ${block.getAttribute('data-position')}</p>
            <p>Nucleotide: ${this.determineNucleotide(doc)}</p>
            <p>Intensity: ${Math.round(this.calculateIntensity(doc) * 100)}%</p>
        `;
        
        const rect = block.getBoundingClientRect();
        info.style.left = `${rect.right + 10}px`;
        info.style.top = `${rect.top}px`;
        
        this.container.appendChild(info);
    }

    hideSequenceInfo() {
        const info = this.container.querySelector('.sequence-info');
        if (info) info.remove();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new KnowledgeInterface();
});
