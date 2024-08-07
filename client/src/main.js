import { helpers } from "./helpers";
import $ from "jquery";
import * as PIXI from "pixi.js-legacy";
import { GameConfig } from "../../shared/gameConfig";
import { math } from "../../shared/utils/math";
import * as net from "../../shared/net";
import { Account } from "./account";
import { Ambiance } from "./ambiance";
import { AudioManager } from "./audioManager";
import { device } from "./device";
import { ConfigManager,defaultConfig,region_name, regions } from "./config";
import { Game } from "./game";
import { InputHandler } from "./input";
import { InputBinds, InputBindUi } from "./inputBinds";
import { loadStaticDomImages } from "./ui/ui2";
import { LoadoutDisplay } from "./ui/opponentDisplay";
import { LoadoutMenu } from "./ui/loadoutMenu";
import { Localization } from "./ui/localization";
import Menu from "./ui/menu";
import { MenuModal } from "./ui/menuModal";
import { Pass } from "./ui/pass";
import { PingTest } from "./pingTest";
import { ProfileUi } from "./ui/profileUi";
import { ResourceManager } from "./resources";
import { SiteInfo } from "./siteInfo";
import { TeamMenu } from "./ui/teamMenu";
import { api } from "./api";
class Application {
    constructor() {
        this.nameInput = $("#player-name-input-solo");
        this.serverSelect = $("#server-select-main");
        this.muteBtns = $(".btn-sound-toggle");
        this.aimLineBtn = $("#btn-game-aim-line");
        this.masterSliders = $(".sl-master-volume");
        this.soundSliders = $(".sl-sound-volume");
        this.musicSliders = $(".sl-music-volume");
        this.serverWarning = $("#server-warning");
        this.languageSelect = $(".language-select");
        this.startMenuWrapper = $("#start-menu-wrapper");
        this.gameAreaWrapper = $("#game-area-wrapper");
        this.playButtons = $(".play-button-container");
        this.playLoading = $(".play-loading-outer");
        this.errorModal = new MenuModal($("#modal-notification"));
        this.refreshModal = new MenuModal($("#modal-refresh"));
        this.config = new ConfigManager();
        this.localization = new Localization();
        this.account = new Account(this.config);
        this.loadoutMenu = new LoadoutMenu(
            this.account,
            this.localization
        );
        this.pass = new Pass(
            this.account,
            this.loadoutMenu,
            this.localization
        );
        this.profileUi = new ProfileUi(
            this.account,
            this.localization,
            this.loadoutMenu,
            this.errorModal
        );
        this.pingTest = new PingTest();
        this.siteInfo = new SiteInfo(this.config, this.localization);
        this.audioManager = new AudioManager();
        this.ambience = new Ambiance();
        this.teamMenu = new TeamMenu(
            this.config,
            this.pingTest,
            this.siteInfo,
            this.localization,
            this.audioManager,
            this.onTeamMenuJoinGame.bind(this),
            this.onTeamMenuLeave.bind(this)
        );
        this.pixi = null;
        this.resourceManager = null;
        this.input = null;
        this.inputBinds = null;
        this.inputBindUi = null;
        this.game = null;
        this.loadoutDisplay = null;
        this.domContentLoaded = false;
        this.configLoaded = false;
        this.initialized = false;
        this.active = false;
        this.sessionId = helpers.random64();
        this.contextListener = function(e) {
            e.preventDefault();
        };
        this.errorMessage = "";
        this.quickPlayPendingModeIdx = -1;
        this.findGameAttempts = 0;
        this.findGameTime = 0;
        this.pauseTime = 0;
        this.wasPlayingVideo = false;
        this.checkedPingTest = false;
        this.hasFocus = true;
        this.newsDisplayed = false;
        const onLoadComplete = () => {
            for(const i of Object.keys(regions)){
                const server=document.createElement("option")
                server.value=i
                server.innerHTML=regions[i].name
                server.label=regions[i].name
                $("#server-opts").get()[0].appendChild(server)
            }
            this.config.load(() => {
                this.configLoaded = true;
                this.tryLoad();
            });
        };
        this.loadBrowserDeps(onLoadComplete);
    }

    loadBrowserDeps(onLoadCompleteCb) {
        onLoadCompleteCb();
    }

    tryLoad() {
        if (
            this.domContentLoaded &&
            this.configLoaded &&
            !this.initialized
        ) {
            this.initialized = true;
            this.config.teamAutoFill = true;
            if (device.mobile) {
                Menu.applyMobileBrowserStyling(device.tablet);
            }
            const t =
                this.config.get("language") ||
                this.localization.detectLocale();
            this.config.set("language", t);
            this.localization.setLocale(t);
            this.localization.populateLanguageSelect();
            this.startPingTest();
            this.siteInfo.load(this);
            const opts=document.querySelector("#server-select-main")
            opts.addEventListener("change",(e)=>{
                this.siteInfo.load(this)
            })
            this.localization.localizeIndex();
            this.account.init();

            this.nameInput.maxLength = net.Constants.PlayerNameMaxLen;
            this.serverSelect.change(() => {
                const t = this.serverSelect.find(":selected").val();
                this.config.set("region", t);
            });
            this.nameInput.on("blur", (t) => {
                this.setConfigFromDOM();
            });
            this.muteBtns.on("click", (t) => {
                this.config.set(
                    "muteAudio",
                    !this.config.get("muteAudio")
                );
            });
            this.muteBtns.on("mousedown", (e) => {
                e.stopPropagation();
            });
            $(this.masterSliders).on("mousedown", (e) => {
                e.stopPropagation();
            });
            $(this.soundSliders).on("mousedown", (e) => {
                e.stopPropagation();
            });
            $(this.musicSliders).on("mousedown", (e) => {
                e.stopPropagation();
            });
            this.masterSliders.on("input", (t) => {
                const r = $(t.target).val() / 100;
                this.audioManager.setMasterVolume(r);
                this.config.set("masterVolume", r);
            });
            this.soundSliders.on("input", (t) => {
                const r = $(t.target).val() / 100;
                this.audioManager.setSoundVolume(r);
                this.config.set("soundVolume", r);
            });
            this.musicSliders.on("input", (t) => {
                const r = $(t.target).val() / 100;
                this.audioManager.setMusicVolume(r);
                this.config.set("musicVolume", r);
            });
            $(".modal-settings-item")
                .children("input")
                .each((t, r) => {
                    const a = $(r);
                    a.prop("checked", this.config.get(a.prop("id")));
                });
            $(".modal-settings-item > input:checkbox").change(
                (t) => {
                    const r = $(t.target);
                    this.config.set(r.prop("id"), r.is(":checked"));
                }
            );
            $(".btn-fullscreen-toggle").on("click", () => {
                helpers.toggleFullScreen();
            });
            this.languageSelect.on("change", (t) => {
                const r = t.target.value;
                if (r) {
                    this.config.set("language", r);
                }
            });
            $("#btn-create-team").on("click", () => {
                this.tryJoinTeam(true);
            });
            $("#btn-team-mobile-link-join").on("click", () => {
                let t = $("#team-link-input").val().trim();
                const r = t.indexOf("#");
                if (r >= 0) {
                    t = t.slice(r + 1);
                }
                if (t.length > 0) {
                    $("#team-mobile-link").css("display", "none");
                    this.tryJoinTeam(false, t);
                } else {
                    $("#team-mobile-link-desc").css(
                        "display",
                        "none"
                    );
                    $("#team-mobile-link-warning")
                        .css("display", "none")
                        .fadeIn(100);
                }
            });
            $("#btn-team-leave").on("click", () => {
                if (window.history) {
                    window.history.replaceState("", "", "/");
                }
                this.game?.free();
                this.teamMenu.leave();
            });
            const r = $("#news-current").data("date");
            const a = new Date(r).getTime();
            $(".right-column-toggle").on("click", () => {
                if (this.newsDisplayed) {
                    $("#news-wrapper").fadeOut(250);
                    $("#pass-wrapper").fadeIn(250);
                } else {
                    this.config.set("lastNewsTimestamp", a);
                    $(".news-toggle")
                        .find(".account-alert")
                        .css("display", "none");
                    $("#news-wrapper").fadeIn(250);
                    $("#pass-wrapper").fadeOut(250);
                }
                this.newsDisplayed = !this.newsDisplayed;
            });
            const i = this.config.get("lastNewsTimestamp");
            if (a > i) {
                $(".news-toggle")
                    .find(".account-alert")
                    .css("display", "block");
            }
            this.setDOMFromConfig();
            this.setAppActive(true);
            const domCanvas = document.getElementById("cvs");

            const rendererRes = window.devicePixelRatio > 1 ? 2 : 1;

            if (device.os == "ios") {
                PIXI.settings.PRECISION_FRAGMENT = "highp";
            }

            const createPixiApplication = (forceCanvas) => {
                return new PIXI.Application({
                    width: window.innerWidth,
                    height: window.innerHeight,
                    view: domCanvas,
                    antialias: false,
                    resolution: rendererRes,
                    hello: true,
                    forceCanvas
                });
            };
            let pixi = null;
            try {
                pixi = createPixiApplication(false);
            } catch (e) {
                pixi = createPixiApplication(true);
            }
            this.pixi = pixi;
            this.pixi.renderer.events.destroy();
            this.pixi.ticker.add(this.update, this);
            this.pixi.renderer.background.color = 7378501;
            this.resourceManager = new ResourceManager(
                this.pixi.renderer,
                this.audioManager,
                this.config
            );
            this.resourceManager.loadMapAssets("main");
            this.input = new InputHandler(
                document.getElementById("game-touch-area")
            );
            this.inputBinds = new InputBinds(
                this.input,
                this.config
            );
            this.inputBindUi = new InputBindUi(
                this.input,
                this.inputBinds
            );
            const onJoin = () => {
                this.loadoutDisplay.n();
                this.game.init();
                this.onResize();
                this.findGameAttempts = 0;
                this.ambience.onGameStart();
            };
            const onQuit = (t) => {
                if (this.game.updatePass) {
                    this.pass.scheduleUpdatePass(
                        this.game.updatePassDelay
                    );
                }
                this.game.free();
                this.errorMessage = this.localization.translate(t || "");
                this.teamMenu.onGameComplete();
                this.ambience.onGameComplete(this.audioManager);
                this.setAppActive(true);
                this.setPlayLockout(false);
                if (t == "index-invalid-protocol") {
                    this.showInvalidProtocolModal();
                }
            };
            this.game = new Game(
                this.pixi,
                this.audioManager,
                this.localization,
                this.config,
                this.input,
                this.inputBinds,
                this.inputBindUi,
                this.ambience,
                this.resourceManager,
                onJoin,
                onQuit
            );
            this.loadoutDisplay = new LoadoutDisplay(
                this.pixi,
                this.audioManager,
                this.config,
                this.inputBinds,
                this.account
            );
            this.loadoutMenu.loadoutDisplay = this.loadoutDisplay;
            this.onResize();
            this.tryJoinTeam(false);
            Menu.setupModals(this.inputBinds, this.inputBindUi);
            this.onConfigModified();
            this.config.addModifiedListener(
                this.onConfigModified.bind(this)
            );
            loadStaticDomImages();
        }
    }

    onUnload() {
        this.teamMenu.leave();
    }

    onResize() {
        device.onResize();
        Menu.onResize();
        this.loadoutMenu.onResize();
        this.pixi?.renderer.resize(device.screenWidth, device.screenHeight);
        if (this.game?.initialized) {
            this.game.resize();
        }
        if (this.loadoutDisplay?.initialized) {
            this.loadoutDisplay.resize();
        }
        this.refreshUi();
    }

    startPingTest() {
        const regions = this.config.get("regionSelected")
            ? [this.config.get("region")]
            : this.pingTest.getRegionList();
        this.pingTest.start(regions);
    }

    setAppActive(active) {
        this.active = active;
        this.quickPlayPendingModeIdx = -1;
        this.refreshUi();

        // Certain systems, like the account, can throw errors
        // while the user is already in a game.
        // Seeing these errors when returning to the menu would be
        // confusing, so we'll hide the modal instead.
        if (active) {
            this.errorModal.hide();
        }
    }

    setPlayLockout(lock) {
        const delay = lock ? 0 : 1000;
        this.playButtons
            .stop()
            .delay(delay)
            .animate(
                {
                    opacity: lock ? 0.5 : 1
                },
                250
            );
        this.playLoading
            .stop()
            .delay(delay)
            .animate(
                {
                    opacity: lock ? 1 : 0
                },
                {
                    duration: 250,
                    start: () => {
                        this.playLoading.css({
                            "pointer-events": lock ? "initial" : "none"
                        });
                    }
                }
            );
    }

    onTeamMenuJoinGame(data) {
        this.waitOnAccount(() => {
            this.joinGame(data);
        });
    }

    onTeamMenuLeave(errTxt) {
        if (errTxt && errTxt != "" && window.history) {
            window.history.replaceState("", "", "/");
        }
        this.errorMessage = errTxt;
        this.setDOMFromConfig();
        this.refreshUi();
    }

    // Config
    setConfigFromDOM() {
        const playerName = helpers.sanitizeNameInput(this.nameInput.val());
        this.config.set("playerName", playerName);
        const region = this.serverSelect.find(":selected").val();
        this.config.set("region", region);
    }

    setDOMFromConfig() {
        this.nameInput.val(this.config.get("playerName"));
        this.serverSelect.find("option").each((i, ele) => {
            ele.selected = ele.value == this.config.get("region");
        });
        this.languageSelect.val(this.config.get("language"));
    }

    onConfigModified(key) {
        const muteAudio = this.config.get("muteAudio");
        if (muteAudio != this.audioManager.mute) {
            this.muteBtns.removeClass(
                muteAudio ? "audio-on-icon" : "audio-off-icon"
            );
            this.muteBtns.addClass(
                muteAudio ? "audio-off-icon" : "audio-on-icon"
            );
            this.audioManager.setMute(muteAudio);
        }

        const masterVolume = this.config.get("masterVolume");
        this.masterSliders.val(masterVolume * 100);
        this.audioManager.setMasterVolume(masterVolume);

        const soundVolume = this.config.get("soundVolume");
        this.soundSliders.val(soundVolume * 100);
        this.audioManager.setSoundVolume(soundVolume);

        const musicVolume = this.config.get("musicVolume");
        this.musicSliders.val(musicVolume * 100);
        this.audioManager.setMusicVolume(musicVolume);

        if (key == "language") {
            const language = this.config.get("language");
            this.localization.setLocale(language);
        }

        if (key == "region") {
            this.config.set("regionSelected", true);
            this.startPingTest();
        }

        if (key == "highResTex") {
            location.reload();
        }
    }

    refreshUi() {
        this.startMenuWrapper.css(
            "display",
            this.active ? "flex" : "none"
        );
        this.gameAreaWrapper.css({
            display: this.active ? "none" : "block",
            opacity: this.active ? 0 : 1
        });
        if (this.active) {
            $("body").removeClass("user-select-none");
            document.removeEventListener(
                "contextmenu",
                this.contextListener
            );
        } else {
            $("body").addClass("user-select-none");
            $("#start-main").stop(true);
            document.addEventListener(
                "contextmenu",
                this.contextListener
            );
        }

        // Hide the left section if on mobile, oriented portrait, and viewing create team
        $("#ad-block-left").css(
            "display",
            !device.isLandscape && this.teamMenu.active
                ? "none"
                : "block"
        );

        // Warning
        const hasError = this.active && this.errorMessage != "";
        this.serverWarning.css({
            display: "block",
            opacity: hasError ? 1 : 0
        });
        this.serverWarning.html(this.errorMessage);
    }

    waitOnAccount(cb) {
        if (this.account.requestsInFlight == 0) {
            cb();
        } else {
            // Wait some maximum amount of time for pending account requests
            const timeout = setTimeout(() => {
                runOnce();
            }, 2500);
            const runOnce = () => {
                cb();
                clearTimeout(timeout);
                this.account.removeEventListener(
                    "requestsComplete",
                    runOnce
                );
            };
            this.account.addEventListener("requestsComplete", runOnce);
        }
    }

    tryJoinTeam(create, url) {
        if (this.active && this.quickPlayPendingModeIdx === -1) {
            // Join team if the url contains a team address
            const roomUrl = url || window.location.hash.slice(1);
            if (create || roomUrl != "") {
                // The main menu and squad menus have separate
                // DOM elements for input, such as player name and
                // selected region. We will stash the menu values
                // into the config so the team menu can read them.
                this.setConfigFromDOM();
                this.teamMenu.connect(create, roomUrl);
                this.refreshUi();
            }
        }
    }

    tryQuickStartGame(gameModeIdx) {
        if (this.quickPlayPendingModeIdx === -1) {
            // Update UI to display a spinner on the play button
            this.errorMessage = "";
            this.quickPlayPendingModeIdx = gameModeIdx;
            this.setConfigFromDOM();
            this.refreshUi();

            // Wait some amount of time if we've recently attempted to
            // find a game to prevent spamming the server
            let delay = 0;
            if (
                this.findGameAttempts > 0 &&
                Date.now() - this.findGameTime < 30000
            ) {
                delay = Math.min(
                    this.findGameAttempts * 2.5 * 1000,
                    7500
                );
            } else {
                this.findGameAttempts = 0;
            }
            this.findGameTime = Date.now();
            this.findGameAttempts++;

            const version = GameConfig.protocolVersion;
            let region = this.config.get("region");
            const paramRegion = helpers.getParameterByName("region");
            if (paramRegion !== undefined && paramRegion.length > 0) {
                region = paramRegion;
            }
            let zones = this.pingTest.getZones(region);
            const paramZone = helpers.getParameterByName("zone");
            if (paramZone !== undefined && paramZone.length > 0) {
                zones = [paramZone];
            }

            const matchArgs = {
                version,
                playerCount: 1,
                autoFill: true,
                gameMode:gameModeIdx
            };

            const tryQuickStartGameImpl = () => {
                this.waitOnAccount(() => {
                    this.findGame(matchArgs, (err, matchData,sp=0) => {
                        if (err) {
                            this.onJoinGameError(err);
                            return;
                        }
                        this.joinGame(matchData,sp);
                    } );
                });
            };

            if (delay == 0) {
                // We can improve findGame responsiveness by ~30 ms by skipping
                // the 0ms setTimeout
                tryQuickStartGameImpl();
            } else {
                setTimeout(() => {
                    tryQuickStartGameImpl();
                }, delay);
            }
        }
    }

    findGame(matchArgs, _cb,sp=0) {
        const This=this;
        (async function findGameImpl(iter,sp, maxAttempts) {
            if (iter >= maxAttempts) {
                _cb("full");
                return;
            }
            if(!regions[This.config.get("region")]){
                This.config.region=defaultConfig.region
            }
            const headers=new Headers()
            headers.set("Access-Control-Allow-Origin","*")
            let url=""
            if(sp==0){
                url=`http${region_name(This.config.get("region"))}/api/find_game?gameMode=${matchArgs.gameMode}`
            }else{
                url=`http${api.changePort(region_name(this.config.get("region")),this.siteInfo.info[this.config.get("region")].childPorts[sp-1])}/api/find_game?gameMode=${matchArgs.gameMode}`
            }
            fetch(url).then((res=>res.json())).then(function(data){
                if(data.err){
                    if(sp>this.siteInfo.info[this.config.get("region")].childPorts.length){
                        return
                    }
                    findGameImpl.call(this,iter+1,sp+1,maxAttempts)
                    return
                }else{
                    _cb(null, data,sp);
                }
            }.bind(this))
        }).call(this,0,sp, 5);
    }

    joinGame(matchData,sp=0) {
        if (!this.game) {
            setTimeout(() => {
                this.joinGame(matchData);
            }, 250);
            return;
        }
        const urls=[]
        if(sp==0){
            urls.push(
                `ws${region_name(this.config.get("region"))}/play?gameID=${matchData.gameId}`
            );
        }else{
            urls.push(`ws${api.changePort(region_name(this.config.get("region")),this.siteInfo.info[this.config.get("region")].childPorts[sp-1])}/play?gameID=${matchData.gameId}`)
        }
        const joinGameImpl = (urls, matchData) => {
            const url = urls.shift();
            if (!url) {
                this.onJoinGameError("join_game_failed");
                return;
            }
            console.log("Joining", url, matchData.zone);
            const onFailure = function() {
                joinGameImpl(urls, matchData);
            };
            this.game.tryJoinGame(
                url,
                matchData.data,
                this.account.loadoutPriv,
                this.account.questPriv,
                onFailure
            );
        };
        joinGameImpl(urls, matchData);
    }

    onJoinGameError(err) {
        const errMap = {
            full: this.localization.translate(
                "index-failed-finding-game"
            ),
            invalid_protocol: this.localization.translate(
                "index-invalid-protocol"
            ),
            join_game_failed: this.localization.translate(
                "index-failed-joining-game"
            )
        };
        if (err == "invalid_protocol") {
            this.showInvalidProtocolModal();
        }
        this.errorMessage = errMap[err] || errMap.full;
        this.quickPlayPendingModeIdx = -1;
        this.teamMenu.leave("join_game_failed");
        this.refreshUi();
    }

    showInvalidProtocolModal() {
        this.refreshModal.show(true);
    }

    update() {
        const dt = math.clamp(
            this.pixi.ticker.elapsedMS / 1000,
            0.001,
            1 / 8
        );
        this.pingTest.update(dt);
        if (!this.checkedPingTest && this.pingTest.isComplete()) {
            if (!this.config.get("regionSelected")) {
                const region = this.pingTest.getRegion();

                if (region) {
                    this.config.set("region", region);
                    this.setDOMFromConfig();
                }
            }
            this.checkedPingTest = true;
        }
        this.resourceManager.update(dt);
        this.audioManager.update(dt);
        this.ambience.update(dt, this.audioManager, !this.active);
        this.teamMenu.update(dt);

        // Game update
        if (this.game?.initialized && this.game.playing) {
            if (this.active) {
                this.setAppActive(false);
                this.setPlayLockout(true);
            }
            this.game.update(dt);
        }

        // LoadoutDisplay update
        if (
            this.active &&
            this.loadoutDisplay &&
            this.game &&
            !this.game.initialized
        ) {
            if (this.loadoutMenu.active) {
                if (!this.loadoutDisplay.initialized) {
                    this.loadoutDisplay.o();
                }
                this.loadoutDisplay.show();
                this.loadoutDisplay.update(dt, this.hasFocus);
            } else {
                this.loadoutDisplay.hide();
            }
        }
        if (!this.active && this.loadoutMenu.active) {
            this.loadoutMenu.hide();
        }
        if (this.active) {
            this.pass?.update(dt);
        }
        this.input.flush();
    }
}

const App = new Application();

function onPageLoad() {
    App.domContentLoaded = true;
    App.tryLoad();
}

document.addEventListener("DOMContentLoaded", onPageLoad);
window.addEventListener("load", onPageLoad);
window.addEventListener("unload", (e) => {
    App.onUnload();
});
if (window.location.hash == "#_=_") {
    window.location.hash = "";
    history.pushState("", document.title, window.location.pathname);
}
window.addEventListener("resize", () => {
    App.onResize();
});
window.addEventListener("orientationchange", () => {
    App.onResize();
});
window.addEventListener("hashchange", () => {
    App.tryJoinTeam(false);
});
window.addEventListener("beforeunload", (e) => {
    if (App.game?.warnPageReload()) {
        // In new browsers, dialogText is overridden by a generic string
        const dialogText = "Do you want to reload the game?";
        e.returnValue = dialogText;
        return dialogText;
    }
});
window.addEventListener("onfocus", () => {
    App.hasFocus = true;
});
window.addEventListener("onblur", () => {
    App.hasFocus = false;
});

const reportedErrors = [];
window.onerror = function(msg, url, lineNo, columnNo, error) {
    msg = msg || "undefined_error_msg";
    const stacktrace = error ? error.stack : "";

    // Break a malicious iOS app and other extensions
    if (
        msg.indexOf("').innerText") != -1 ||
        stacktrace.includes("cdn.rawgit.com") ||
        stacktrace.includes("chrome-extension://")
    ) {
        helpers.cheatDetected();
        return;
    }
    const errObj = {
        msg,
        id: App.sessionId,
        url,
        line: lineNo,
        column: columnNo,
        stacktrace,
        browser: navigator.userAgent,
        protocol: GameConfig.protocolVersion
    };
    const errStr = JSON.stringify(errObj);

    // Don't report the same error multiple times
    if (!reportedErrors.includes(errStr)) {
        reportedErrors.push(errStr);
        console.error("windowOnError", errStr);
    }
};
