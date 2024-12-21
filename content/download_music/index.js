class BookmarkedAudioTrack {
  track = {
    display_artist: "",
    title: "",
    audio_cluster_id: "",
    progressive_download_url: "",
  };
  constructor({ track }) {
    this.track = track;
  }
}

class BookmarkedAudioOriginal {
  original_sound = {
    audio_asset_id: "",
    progressive_download_url: "",
    original_audio_title: "",
    ig_artist: {
      username: "",
    },
  };
  constructor({ original_sound }) {
    this.original_sound = original_sound;
  }
}

const app = {
  rootNode: null,
  childrens: [],
  buttons: [],
  bookmarked: [],
  headers: null,

  init() {
    this.getHeaders()
      // GET HEADERS
      .then(({ headers }) => {
        if (!headers) {
          throw new Error("HEADERS NOT FOUND");
        }
        // Response from background script,
        // to save response headers from bookmarked audio track

        // Problems with making request from instagram,
        // since crsf token required to make request.

        // Tried to take csrf token from previous request, but there is some additional headers added.
        // Problems, while making request to API.

        // I NEED JSON WITH TRACKS
        // GET JSON RESPONSE FROM WEB REQUEST I CAN'T BECAUSE OF RESTRICTIONS

        // MY SOLUTION LIES IN: TAKE HEADERS FROM THE SAME REQUEST AND MAKE REQUEST AGAIN BY MYSELF.
        this.getBookmarked(headers).then((bookmarked) => {
          if (
            bookmarked &&
            "items" in bookmarked &&
            Array.isArray(bookmarked.items)
          ) {
            this.bookmarked = bookmarked.items.map((item) => {
              if (!("track" in item) && "original_sound" in item) {
                return new BookmarkedAudioOriginal(item);
              } else {
                return new BookmarkedAudioTrack(item);
              }
            });
          }
          // Use promise becuse of need result from setInterval.
          new Promise((res, rej) => {
            // GET ROOT NODE
            let node = null;
            let attemptsLeft = 5;
            const id = setInterval(() => {
              node = this.getRootNode("audio");
              attemptsLeft -= 1;
              if (attemptsLeft === 0) {
                clearInterval(id);
                rej("Root node not found.");
              }
              if (node) {
                clearInterval(id);
                res(node);
              }
            }, 1000);
          })
            // INITIALIZE UI
            .then((node) => {
              this.rootNode = node;
              this.childrens = this.getChildrens(this.rootNode);
              this.attachDownloadButton();
              this.observe();
            })

            .catch((message) => {
              console.warn(message);
            });
        });
      })
      .catch((err) => {
        console.warn(err.message);
      });
  },

  createButton({ onClick, children }) {
    const btn = document.createElement("button");
    btn.style = "border: none; background: transparent; cursor: pointer;";
    btn.innerHTML = children;
    btn.addEventListener("click", onClick);
    return btn;
  },

  getRootNode(selector) {
    const rootNode = document.querySelector(selector);
    if (!rootNode) {
      return null;
    }
    return rootNode.nextSibling.firstChild;
  },

  getChildrens(node) {
    return node.childNodes;
  },

  async getHeaders() {
    const response = await chrome.runtime.sendMessage({ type: "headers" });
    return response;
  },

  observe() {
    const config = { childList: true };
    const callback = (mutationList, observer) => {
      for (const mutation of mutationList) {
        if (mutation.type === "childList") {
          this.childrens = this.getChildrens(this.rootNode);
          this.detachDownloadButton();
          this.attachDownloadButton();
        }
      }
    };
    const observer = new MutationObserver(callback);
    observer.observe(this.rootNode, config);
  },

  detachDownloadButton() {
    for (const btn of this.buttons) {
      btn.remove();
    }
    this.buttons = [];
  },

  getTrack(id) {
    let track = null;
    for (const _audio of this.bookmarked) {
      let audio = null;
      if ("track" in _audio) {
        audio = new BookmarkedAudioTrack(_audio);
        const trackId = audio.track.audio_cluster_id;
        if (trackId === id) {
          track = audio;
        }
      } else {
        audio = new BookmarkedAudioOriginal(_audio);
        const trackId = audio.original_sound.audio_asset_id;
        if (trackId === id) {
          track = audio;
        }
      }
    }
    return track;
  },

  forceDownload(blob, filename) {
    var a = document.createElement("a");
    a.download = filename;
    a.href = blob;
    // For Firefox https://stackoverflow.com/a/32226068
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  async getBookmarked(headers) {
    // bookmarked route takes optional CURSOR property in FORMDATA
    // This property responsible for DOWNLOAD AUDIO TRACKS when scrolling.
    const h = new Headers();
    for (const header of headers) {
      h.append(header.name, header.value);
    }

    const referrer = window.location.href;
    const response = await fetch(
      "https://www.instagram.com/api/v1/music/playlist/bookmarked/",
      {
        headers: h,
        referrer: referrer,
        referrerPolicy: "strict-origin-when-cross-origin",
        body: "{}",
        method: "POST",
        mode: "cors",
        credentials: "include",
      }
    );
    if (!response.ok) {
      return null;
    } else {
      return await response.json();
    }
  },

  getDownloadName(audio) {
    if (audio instanceof BookmarkedAudioTrack) {
      return audio.track.display_artist + " - " + audio.track.title;
    }

    if (audio instanceof BookmarkedAudioOriginal) {
      return (
        audio.original_sound.ig_artist +
        " - " +
        audio.original_sound.original_audio_title
      );
    }

    return "Name not found";
  },

  attachDownloadButton() {
    for (const track of this.childrens) {
      const btn = this.createButton({
        onClick: () => {
          const id = track.querySelector("a")?.pathname.match(/\d+/g);
          if (!id) {
            console.log("Track Id not found.");
            return;
          }
          const audio = this.getTrack(id[0]);
          // WHY VIDEO IS NOT FOUND???
          // getBookmarked function return 12 tracks.
          // HOW TO GET ALL TRACKS?
          if (!audio) {
            console.log("Download URL not found.");
            return;
          }

          const downloadURL =
            audio instanceof BookmarkedAudioTrack
              ? audio.track.progressive_download_url
              : audio.original_sound.progressive_download_url;
          const downloadTitle =
            audio instanceof BookmarkedAudioTrack
              ? this.getDownloadName(audio)
              : this.getDownloadName(audio);
          fetch(downloadURL)
            .then((response) => response.blob())
            .then((blob) => {
              let blobUrl = window.URL.createObjectURL(blob);
              this.forceDownload(blobUrl, downloadTitle);
            })
            .catch((e) => console.error(e));
        },
        children:
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-line"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>',
      });
      this.buttons.push(btn);
      track.firstChild.firstChild.firstChild.append(btn);
    }
  },
};

app.init();
