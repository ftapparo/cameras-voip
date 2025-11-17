/** @typedef {import("./jsmpeg").Player} Player */

(() => {
    /** @returns {Promise<void>} */
    const importJSMpeg = () =>
        new Promise((resolve, reject) => {
            if (window.JSMpeg) {
                resolve(); // already loaded
                return;
            }

            const script = Object.assign(document.createElement('script'), {
                src: 'https://cdn.jsdelivr.net/gh/phoboslab/jsmpeg@b5799bf/jsmpeg.min.js',
                onload: resolve,
                onerror: reject,
            });
            document.head.appendChild(script);
        });

    /**
     * Creates a `Player` with destroy method. If you intend to create multiple players, you must
     * await for this promise to complete before creating the next player.
     * @param {import("./jsmpeg").PlayerOptions} options
     * @returns {Promise<{player: Player, destroy: () => void}>}
     */
    const loadPlayer = ({
        url,
        onDisconnect,
        disconnectThreshold = 3e3,
        ...options
    }) =>
        importJSMpeg().then(() => {
            return new Promise((resolve, reject) => {
                // hide the canvas until it's loaded and the correct size
                const originalDisplay = options.canvas.style.display;
                options.canvas.style.display = 'none';

                let lastRx = Date.now(); // Date.now() is more efficient than performance.now()
                let disconnectInterval = null;

                if (options.onVideoDecode && onDisconnect) {
                    reject(
                        new Error('You cannot specify both onDisconnect and onVideoDecode'),
                    );
                    return;
                }

                const player = new window.JSMpeg.Player(url, {
                    // for performance reasons, only record last packet Rx time if onDisconnect is specified
                    onVideoDecode: onDisconnect
                        ? () => {
                            lastRx = Date.now();
                        }
                        : undefined,

                    // MutationObserver doesn't always work, see #202
                    onSourceEstablished: (...args) => {
                        options.canvas.style.display = originalDisplay;

                        const destroy = () => {
                            console.log('Destroying player...');

                            // Clear disconnect interval
                            if (disconnectInterval) {
                                clearInterval(disconnectInterval);
                                disconnectInterval = null;
                            }

                            // Stop the player
                            if (player) {
                                try {
                                    if (player.destroy) {
                                        player.destroy();
                                    }
                                    if (player.stop) {
                                        player.stop();
                                    }
                                    // Close WebSocket connection
                                    if (player.source && player.source.socket) {
                                        player.source.socket.close();
                                    }
                                } catch (error) {
                                    console.error('Error destroying player:', error);
                                }
                            }
                        };

                        resolve({ player, destroy });
                        return options?.onSourceEstablished?.(...args);
                    },

                    ...options,
                });

                const o = new MutationObserver((mutations) => {
                    if (mutations.some((m) => m.type === 'attributes')) {
                        options.canvas.style.display = originalDisplay;

                        const destroy = () => {
                            console.log('Destroying player...');

                            // Clear disconnect interval
                            if (disconnectInterval) {
                                clearInterval(disconnectInterval);
                                disconnectInterval = null;
                            }

                            // Stop the player
                            if (player) {
                                try {
                                    if (player.destroy) {
                                        player.destroy();
                                    }
                                    if (player.stop) {
                                        player.stop();
                                    }
                                    // Close WebSocket connection
                                    if (player.source && player.source.socket) {
                                        player.source.socket.close();
                                    }
                                } catch (error) {
                                    console.error('Error destroying player:', error);
                                }
                            }
                        };

                        resolve({ player, destroy });
                        o.disconnect();
                    }
                });
                o.observe(options.canvas, { attributes: true });

                if (onDisconnect) {
                    disconnectInterval = setInterval(() => {
                        if (Date.now() - lastRx > disconnectThreshold) {
                            onDisconnect(player);
                            clearInterval(disconnectInterval);
                            disconnectInterval = null;
                        }
                    }, disconnectThreshold / 2);
                }
            });
        });

    if (typeof module !== 'undefined') {
        // being imported
        module.exports = { loadPlayer };
    } else {
        // loaded via script tag
        window.loadPlayer = loadPlayer;
    }
})();
