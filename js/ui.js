class ChessUI {
    constructor(game) {
        this.game = game;
        this.boardElement = document.getElementById('chessboard');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.gameStatus = document.getElementById('game-status');
        this.moveListElement = document.getElementById('move-list');
        this.whiteCapturesElement = document.getElementById('white-captures');
        this.blackCapturesElement = document.getElementById('black-captures');
        
        this.gameOverModal = document.getElementById('game-over-modal');
        this.promotionModal = document.getElementById('promotion-modal');
        
        this.selectedSquare = null; // {r, c}
        this.legalMovesForSelected = [];
        this.promotionMove = null; // Stores move details when promotion is pending
        
        this.initBoard();
        this.setupEventListeners();
        this.update();
    }

    initBoard() {
        this.boardElement.innerHTML = '';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const square = document.createElement('div');
                square.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.r = r;
                square.dataset.c = c;
                
                // Event Listeners for click and drop
                square.addEventListener('click', () => this.handleSquareClick(r, c));
                square.addEventListener('dragover', (e) => e.preventDefault());
                square.addEventListener('drop', (e) => this.handleDrop(e, r, c));
                
                this.boardElement.appendChild(square);
            }
        }
    }

    setupEventListeners() {
        document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());
        document.getElementById('modal-restart-btn').addEventListener('click', () => {
            this.gameOverModal.style.display = 'none';
            this.restartGame();
        });
    }

    getSquareElement(r, c) {
        return this.boardElement.querySelector(`.square[data-r="${r}"][data-c="${c}"]`);
    }

    clearHighlights() {
        const squares = this.boardElement.querySelectorAll('.square');
        squares.forEach(sq => {
            sq.classList.remove('highlight', 'valid-move', 'valid-capture', 'in-check');
        });
    }

    highlightSquare(r, c, type) {
        const sq = this.getSquareElement(r, c);
        if (sq) sq.classList.add(type);
    }

    renderBoard() {
        // Clear all pieces
        const squares = this.boardElement.querySelectorAll('.square');
        squares.forEach(sq => sq.innerHTML = '');

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.game.getPiece(r, c);
                if (piece) {
                    const sq = this.getSquareElement(r, c);
                    const pieceEl = document.createElement('div');
                    pieceEl.className = 'piece';
                    pieceEl.draggable = true;
                    pieceEl.innerHTML = piecesSvg[piece.color + piece.type];
                    
                    // Drag events
                    pieceEl.addEventListener('dragstart', (e) => this.handleDragStart(e, r, c));
                    pieceEl.addEventListener('dragend', (e) => this.handleDragEnd(e));
                    
                    sq.appendChild(pieceEl);
                }
            }
        }
    }

    handleDragStart(e, r, c) {
        const piece = this.game.getPiece(r, c);
        if (!piece || piece.color !== this.game.turn) {
            e.preventDefault();
            return;
        }
        
        this.selectedSquare = { r, c };
        this.legalMovesForSelected = this.game.getLegalMoves(r, c);
        
        e.dataTransfer.setData('text/plain', JSON.stringify({ r, c }));
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => e.target.classList.add('dragging'), 0);
        
        this.drawHighlights();
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
    }

    handleDrop(e, targetR, targetC) {
        e.preventDefault();
        const data = e.dataTransfer.getData('text/plain');
        if (!data) return;
        
        const source = JSON.parse(data);
        if (source.r === targetR && source.c === targetC) return;
        
        this.attemptMove(source.r, source.c, targetR, targetC);
    }

    handleSquareClick(r, c) {
        const piece = this.game.getPiece(r, c);
        
        // If clicking on a valid move destination
        if (this.selectedSquare) {
            const isMoveValid = this.legalMovesForSelected.some(m => m.to.r === r && m.to.c === c);
            if (isMoveValid) {
                this.attemptMove(this.selectedSquare.r, this.selectedSquare.c, r, c);
                return;
            }
        }

        // Select piece
        if (piece && piece.color === this.game.turn) {
            this.selectedSquare = { r, c };
            this.legalMovesForSelected = this.game.getLegalMoves(r, c);
            this.drawHighlights();
        } else {
            this.selectedSquare = null;
            this.legalMovesForSelected = [];
            this.drawHighlights();
        }
    }

    drawHighlights() {
        this.clearHighlights();
        
        if (this.game.inCheck) {
            // Find king and highlight
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const p = this.game.getPiece(r, c);
                    if (p && p.type === 'k' && p.color === this.game.turn) {
                        this.highlightSquare(r, c, 'in-check');
                    }
                }
            }
        }

        if (this.selectedSquare) {
            this.highlightSquare(this.selectedSquare.r, this.selectedSquare.c, 'highlight');
            
            for (const move of this.legalMovesForSelected) {
                const isCapture = this.game.getPiece(move.to.r, move.to.c) !== null || (move.flags && move.flags.includes('e'));
                this.highlightSquare(move.to.r, move.to.c, isCapture ? 'valid-capture' : 'valid-move');
            }
        }
    }

    attemptMove(fromR, fromC, toR, toC) {
        const move = this.legalMovesForSelected.find(m => m.to.r === toR && m.to.c === toC);
        if (!move) {
            this.selectedSquare = null;
            this.legalMovesForSelected = [];
            this.drawHighlights();
            return;
        }

        if (move.flags && move.flags.includes('p')) {
            // Show promotion modal
            this.promotionMove = { fromR, fromC, toR, toC };
            this.showPromotionModal(this.game.turn);
        } else {
            this.executeMove(fromR, fromC, toR, toC);
        }
    }

    executeMove(fromR, fromC, toR, toC, promotionType = 'q') {
        const success = this.game.move(fromR, fromC, toR, toC, promotionType);
        if (success) {
            this.selectedSquare = null;
            this.legalMovesForSelected = [];
            this.update();
        }
    }

    showPromotionModal(color) {
        const optionsContainer = document.getElementById('promotion-options');
        optionsContainer.innerHTML = '';
        
        const pieces = ['q', 'r', 'b', 'n'];
        pieces.forEach(type => {
            const opt = document.createElement('div');
            opt.className = 'promotion-piece';
            opt.innerHTML = piecesSvg[color + type];
            opt.addEventListener('click', () => {
                this.promotionModal.style.display = 'none';
                const { fromR, fromC, toR, toC } = this.promotionMove;
                this.executeMove(fromR, fromC, toR, toC, type);
                this.promotionMove = null;
            });
            optionsContainer.appendChild(opt);
        });
        
        this.promotionModal.style.display = 'flex';
    }

    update() {
        this.renderBoard();
        this.drawHighlights();
        this.updateSidePanels();
        this.checkGameOver();
    }

    updateSidePanels() {
        // Turn indicator
        this.turnIndicator.textContent = this.game.turn === 'w' ? "White's Turn" : "Black's Turn";
        this.turnIndicator.style.color = this.game.turn === 'w' ? "#fff" : "#888";
        
        // Status
        if (this.game.isCheckmate) {
            this.gameStatus.textContent = "Checkmate!";
        } else if (this.game.isStalemate) {
            this.gameStatus.textContent = "Stalemate";
        } else if (this.game.inCheck) {
            this.gameStatus.textContent = "Check!";
        } else {
            this.gameStatus.textContent = "In Progress";
        }

        // Captured pieces
        this.whiteCapturesElement.innerHTML = '';
        this.game.capturedPieces.w.forEach(p => {
            const el = document.createElement('div');
            el.innerHTML = piecesSvg[p];
            this.whiteCapturesElement.appendChild(el);
        });

        this.blackCapturesElement.innerHTML = '';
        this.game.capturedPieces.b.forEach(p => {
            const el = document.createElement('div');
            el.innerHTML = piecesSvg[p];
            this.blackCapturesElement.appendChild(el);
        });

        // Move History
        this.moveListElement.innerHTML = '';
        for (let i = 0; i < this.game.history.length; i += 2) {
            const tr = document.createElement('tr');
            
            const tdNum = document.createElement('td');
            tdNum.textContent = (i / 2 + 1) + '.';
            tr.appendChild(tdNum);

            const tdWhite = document.createElement('td');
            tdWhite.textContent = this.formatMove(this.game.history[i]);
            tr.appendChild(tdWhite);

            const tdBlack = document.createElement('td');
            if (this.game.history[i + 1]) {
                tdBlack.textContent = this.formatMove(this.game.history[i + 1]);
            }
            tr.appendChild(tdBlack);

            this.moveListElement.appendChild(tr);
        }
        
        // Scroll to bottom
        const historyContainer = document.getElementById('move-history');
        historyContainer.scrollTop = historyContainer.scrollHeight;
    }

    formatMove(historyEntry) {
        if (!historyEntry) return '';
        const { from, to, piece, flags, promotion, isCapture } = historyEntry;
        
        if (flags && flags.includes('k')) return 'O-O';
        if (flags && flags.includes('q')) return 'O-O-O';

        let str = '';
        if (piece.type !== 'p') {
            str += piece.type.toUpperCase();
        }
        
        if (isCapture) {
            if (piece.type === 'p') str += this.game.coordsToAlgebraic(from.r, from.c).charAt(0);
            str += 'x';
        }
        
        str += this.game.coordsToAlgebraic(to.r, to.c);
        
        if (promotion) {
            str += '=' + promotion.toUpperCase();
        }
        
        // (Not strictly storing if the move caused check, but we could add '+' or '#')
        return str;
    }

    checkGameOver() {
        if (this.game.isCheckmate || this.game.isStalemate) {
            const title = document.getElementById('game-over-title');
            const message = document.getElementById('game-over-message');
            
            if (this.game.isCheckmate) {
                title.textContent = "Checkmate!";
                message.textContent = this.game.turn === 'w' ? "Black wins." : "White wins.";
            } else {
                title.textContent = "Draw!";
                message.textContent = "Stalemate.";
            }
            
            this.gameOverModal.style.display = 'flex';
        }
    }

    restartGame() {
        this.game.reset();
        this.selectedSquare = null;
        this.legalMovesForSelected = [];
        this.update();
    }
}
