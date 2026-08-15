class Chess {
    constructor() {
        this.reset();
    }

    reset() {
        // Board is 8x8 array. 0,0 is top-left (a8). r is row (0-7), c is col (0-7).
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        this.turn = 'w';
        this.history = [];
        this.halfMoves = 0;
        this.fullMoves = 1;
        this.castling = {
            w: { k: true, q: true },
            b: { k: true, q: true }
        };
        this.enPassantTarget = null; // {r, c} or null
        this.capturedPieces = { w: [], b: [] };
        
        this.inCheck = false;
        this.isCheckmate = false;
        this.isStalemate = false;

        this.setupInitialBoard();
        this.updateGameState();
    }

    setupInitialBoard() {
        const initialSetup = [
            ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
            ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
            Array(8).fill(null),
            Array(8).fill(null),
            Array(8).fill(null),
            Array(8).fill(null),
            ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
            ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
        ];

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (initialSetup[r][c]) {
                    this.board[r][c] = {
                        color: initialSetup[r][c][0],
                        type: initialSetup[r][c][1]
                    };
                }
            }
        }
    }

    getPiece(r, c) {
        if (r < 0 || r > 7 || c < 0 || c > 7) return null;
        return this.board[r][c];
    }

    isValidPos(r, c) {
        return r >= 0 && r <= 7 && c >= 0 && c <= 7;
    }

    // Generate pseudo-legal moves for a piece
    getPseudoLegalMoves(r, c) {
        const piece = this.getPiece(r, c);
        if (!piece) return [];
        
        const moves = [];
        const color = piece.color;
        const type = piece.type;
        const dir = color === 'w' ? -1 : 1;

        if (type === 'p') {
            // Forward
            if (this.isValidPos(r + dir, c) && !this.getPiece(r + dir, c)) {
                moves.push({ to: { r: r + dir, c } });
                // Double forward
                const startRow = color === 'w' ? 6 : 1;
                if (r === startRow && !this.getPiece(r + dir * 2, c)) {
                    moves.push({ to: { r: r + dir * 2, c } });
                }
            }
            // Captures
            for (const dc of [-1, 1]) {
                if (this.isValidPos(r + dir, c + dc)) {
                    const target = this.getPiece(r + dir, c + dc);
                    if (target && target.color !== color) {
                        moves.push({ to: { r: r + dir, c: c + dc } });
                    }
                    // En passant
                    if (this.enPassantTarget && this.enPassantTarget.r === r + dir && this.enPassantTarget.c === c + dc) {
                        moves.push({ to: { r: r + dir, c: c + dc }, flags: 'e' });
                    }
                }
            }
        } else if (type === 'n') {
            const knightMoves = [
                [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                [1, -2], [1, 2], [2, -1], [2, 1]
            ];
            for (const [dr, dc] of knightMoves) {
                if (this.isValidPos(r + dr, c + dc)) {
                    const target = this.getPiece(r + dr, c + dc);
                    if (!target || target.color !== color) {
                        moves.push({ to: { r: r + dr, c: c + dc } });
                    }
                }
            }
        } else if (type === 'k') {
            const kingMoves = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1],           [0, 1],
                [1, -1],  [1, 0],  [1, 1]
            ];
            for (const [dr, dc] of kingMoves) {
                if (this.isValidPos(r + dr, c + dc)) {
                    const target = this.getPiece(r + dr, c + dc);
                    if (!target || target.color !== color) {
                        moves.push({ to: { r: r + dr, c: c + dc } });
                    }
                }
            }
            // Castling
            if (!this.isAttacked(r, c, color === 'w' ? 'b' : 'w')) {
                if (this.castling[color].k) {
                    if (!this.getPiece(r, c + 1) && !this.getPiece(r, c + 2) && 
                        !this.isAttacked(r, c + 1, color === 'w' ? 'b' : 'w') && 
                        !this.isAttacked(r, c + 2, color === 'w' ? 'b' : 'w')) {
                        moves.push({ to: { r, c: c + 2 }, flags: 'k' });
                    }
                }
                if (this.castling[color].q) {
                    if (!this.getPiece(r, c - 1) && !this.getPiece(r, c - 2) && !this.getPiece(r, c - 3) && 
                        !this.isAttacked(r, c - 1, color === 'w' ? 'b' : 'w') && 
                        !this.isAttacked(r, c - 2, color === 'w' ? 'b' : 'w')) {
                        moves.push({ to: { r, c: c - 2 }, flags: 'q' });
                    }
                }
            }
        } else {
            // Sliding pieces (b, r, q)
            const dirs = [];
            if (type === 'b' || type === 'q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
            if (type === 'r' || type === 'q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);

            for (const [dr, dc] of dirs) {
                let nr = r + dr;
                let nc = c + dc;
                while (this.isValidPos(nr, nc)) {
                    const target = this.getPiece(nr, nc);
                    if (!target) {
                        moves.push({ to: { r: nr, c: nc } });
                    } else {
                        if (target.color !== color) {
                            moves.push({ to: { r: nr, c: nc } });
                        }
                        break;
                    }
                    nr += dr;
                    nc += dc;
                }
            }
        }

        // Add promotion flag to pawn moves reaching last rank
        if (type === 'p') {
            const promRow = color === 'w' ? 0 : 7;
            moves.forEach(m => {
                if (m.to.r === promRow) m.flags = (m.flags || '') + 'p';
            });
        }

        return moves;
    }

    // Returns true if the square (r, c) is attacked by the given color
    isAttacked(r, c, attackerColor) {
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const p = this.getPiece(i, j);
                if (p && p.color === attackerColor) {
                    // Quick pseudo-legal generation for attackers (without castling/en-passant to avoid recursion loop)
                    const type = p.type;
                    if (type === 'p') {
                        const dir = attackerColor === 'w' ? -1 : 1;
                        if ((i + dir === r && j - 1 === c) || (i + dir === r && j + 1 === c)) return true;
                    } else if (type === 'n') {
                        const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
                        for (const [dr, dc] of knightMoves) {
                            if (i + dr === r && j + dc === c) return true;
                        }
                    } else if (type === 'k') {
                        if (Math.abs(i - r) <= 1 && Math.abs(j - c) <= 1) return true;
                    } else {
                        const dirs = [];
                        if (type === 'b' || type === 'q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
                        if (type === 'r' || type === 'q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
                        for (const [dr, dc] of dirs) {
                            let nr = i + dr;
                            let nc = j + dc;
                            while (this.isValidPos(nr, nc)) {
                                if (nr === r && nc === c) return true;
                                if (this.getPiece(nr, nc)) break;
                                nr += dr;
                                nc += dc;
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    // Filter out moves that leave own king in check
    getLegalMoves(r, c) {
        const moves = this.getPseudoLegalMoves(r, c);
        const color = this.getPiece(r, c).color;
        const legalMoves = [];

        for (const m of moves) {
            // Make move on a copy or make/unmake
            const undo = this.makeMoveInternal({ from: { r, c }, to: m.to, flags: m.flags }, 'q'); // 'q' is default promotion for check test
            
            // Find king
            let kingPos = null;
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    const p = this.getPiece(i, j);
                    if (p && p.type === 'k' && p.color === color) {
                        kingPos = { r: i, c: j };
                        break;
                    }
                }
                if (kingPos) break;
            }

            if (!this.isAttacked(kingPos.r, kingPos.c, color === 'w' ? 'b' : 'w')) {
                legalMoves.push(m);
            }

            this.undoMoveInternal(undo);
        }
        return legalMoves;
    }

    getAllLegalMoves(color) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.getPiece(r, c);
                if (p && p.color === color) {
                    const pieceMoves = this.getLegalMoves(r, c);
                    pieceMoves.forEach(m => moves.push({ from: {r, c}, to: m.to, flags: m.flags }));
                }
            }
        }
        return moves;
    }

    makeMoveInternal(move, promotionType) {
        const { from, to, flags } = move;
        const piece = this.board[from.r][from.c];
        const targetPiece = this.board[to.r][to.c];
        
        let enPassantCapture = null;
        
        // Handle En Passant capture
        if (flags && flags.includes('e')) {
            enPassantCapture = this.board[from.r][to.c];
            this.board[from.r][to.c] = null;
        }

        // Handle Castling
        if (flags && flags.includes('k')) {
            this.board[to.r][to.c - 1] = this.board[to.r][to.c + 1]; // Move Rook
            this.board[to.r][to.c + 1] = null;
        }
        if (flags && flags.includes('q')) {
            this.board[to.r][to.c + 1] = this.board[to.r][to.c - 2]; // Move Rook
            this.board[to.r][to.c - 2] = null;
        }

        // Execute move
        this.board[to.r][to.c] = piece;
        this.board[from.r][from.c] = null;

        // Handle promotion
        if (flags && flags.includes('p') && promotionType) {
            this.board[to.r][to.c] = { color: piece.color, type: promotionType };
        }

        return {
            from, to, piece, targetPiece, flags, enPassantCapture
        };
    }

    undoMoveInternal(undoData) {
        const { from, to, piece, targetPiece, flags, enPassantCapture } = undoData;

        // Revert move
        this.board[from.r][from.c] = piece;
        this.board[to.r][to.c] = targetPiece;

        // Revert promotion (implicit because piece holds the original pawn)

        // Revert En Passant
        if (flags && flags.includes('e')) {
            this.board[from.r][to.c] = enPassantCapture;
        }

        // Revert Castling
        if (flags && flags.includes('k')) {
            this.board[to.r][to.c + 1] = this.board[to.r][to.c - 1]; // Move Rook back
            this.board[to.r][to.c - 1] = null;
        }
        if (flags && flags.includes('q')) {
            this.board[to.r][to.c - 2] = this.board[to.r][to.c + 1]; // Move Rook back
            this.board[to.r][to.c + 1] = null;
        }
    }

    move(fromR, fromC, toR, toC, promotionType = 'q') {
        const legalMoves = this.getLegalMoves(fromR, fromC);
        const move = legalMoves.find(m => m.to.r === toR && m.to.c === toC);
        
        if (!move) return false;

        const piece = this.board[fromR][fromC];
        const isCapture = this.board[toR][toC] !== null || (move.flags && move.flags.includes('e'));

        // Save state before move
        const state = {
            castling: JSON.parse(JSON.stringify(this.castling)),
            enPassantTarget: this.enPassantTarget ? { ...this.enPassantTarget } : null,
            halfMoves: this.halfMoves
        };

        const undo = this.makeMoveInternal({ from: {r: fromR, c: fromC}, to: move.to, flags: move.flags }, promotionType);

        // Update captured pieces
        if (isCapture) {
            const captured = undo.targetPiece || undo.enPassantCapture;
            if (captured) {
                this.capturedPieces[this.turn].push(captured.color + captured.type);
            }
        }

        // Update Castling rights
        if (piece.type === 'k') {
            this.castling[this.turn].k = false;
            this.castling[this.turn].q = false;
        }
        if (piece.type === 'r') {
            if (fromR === 7 && fromC === 7) this.castling.w.k = false;
            if (fromR === 7 && fromC === 0) this.castling.w.q = false;
            if (fromR === 0 && fromC === 7) this.castling.b.k = false;
            if (fromR === 0 && fromC === 0) this.castling.b.q = false;
        }
        // Also update if rook gets captured on its starting square
        if (toR === 7 && toC === 7) this.castling.w.k = false;
        if (toR === 7 && toC === 0) this.castling.w.q = false;
        if (toR === 0 && toC === 7) this.castling.b.k = false;
        if (toR === 0 && toC === 0) this.castling.b.q = false;

        // Update En Passant target
        this.enPassantTarget = null;
        if (piece.type === 'p' && Math.abs(toR - fromR) === 2) {
            this.enPassantTarget = { r: (toR + fromR) / 2, c: toC };
        }

        // Update Half Moves (50-move rule)
        if (piece.type === 'p' || isCapture) {
            this.halfMoves = 0;
        } else {
            this.halfMoves++;
        }

        // Add to history
        this.history.push({
            from: {r: fromR, c: fromC},
            to: {r: toR, c: toC},
            piece: piece,
            flags: move.flags,
            promotion: move.flags && move.flags.includes('p') ? promotionType : null,
            isCapture: isCapture,
            state: state // to allow real undo if needed later
        });

        // Switch turn
        this.turn = this.turn === 'w' ? 'b' : 'w';
        if (this.turn === 'w') this.fullMoves++;

        this.updateGameState();
        return true;
    }

    updateGameState() {
        let kingPos = null;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.getPiece(r, c);
                if (p && p.type === 'k' && p.color === this.turn) {
                    kingPos = { r, c };
                    break;
                }
            }
            if (kingPos) break;
        }

        this.inCheck = this.isAttacked(kingPos.r, kingPos.c, this.turn === 'w' ? 'b' : 'w');
        const legalMoves = this.getAllLegalMoves(this.turn);
        
        if (legalMoves.length === 0) {
            if (this.inCheck) {
                this.isCheckmate = true;
            } else {
                this.isStalemate = true;
            }
        }
    }

    coordsToAlgebraic(r, c) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
        return files[c] + ranks[r];
    }
}
