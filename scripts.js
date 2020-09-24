//  Author: ankojh


(async function () {

  //======================================================================================================================

  //  CONSTANTS

  //======================================================================================================================


  const LYRICS_BASEURL = 'https://api.lyrics.ovh/v1'
  const SUGGESTION_BASEURL = 'https://api.lyrics.ovh/suggest'


  const CLASS_SHOW_LYRICS_LOADER = 'nh-show--lyrics-loader';
  const CLASS_SHOW_LYRICS = 'nh-show--lyrics';
  const CLASS_SHOW_PAGES_CONTAINER = 'nh-show--pages-container';
  const CLASS_SHRINK_LOGO = 'nh-shrink--logo'



  //constants that will be defined after load
  let PAGES_CONTAINER_EL;
  let SEARCH_EL;
  let CONTENT_CONTAINER_EL;
  let LYRICS_CONTAINER_EL;
  let LYRICS_LOADER_EL;
  let LYRICS_CLOSE_EL;

  let TEMPLATE_SUGGESTION_PAGE;
  let TEMPLATE_SUGGESTION_CARD;
  let TEMPLATE_SUGGESTION_PAGE_NOT_FOUND;
  let TEMPLATE_SUGGESTION_PAGE_DUMMY;
  let TEMPLATE_SUGGESTION_CARD_DUMMY;


  //======================================================================================================================

  //  INIT

  //======================================================================================================================



  window.onload = function () {
    setGlobalDOMReferences();
    listenToSearchInputChange(searchChanged);
  }


  function setGlobalDOMReferences() {
    PAGES_CONTAINER_EL = document.body.querySelector('#nh-suggestions-pages-container')
    SEARCH_EL = document.querySelector('#nh-song-search');
    LYRICS_CONTAINER_EL = document.querySelector('#nh-lyrics');
    CONTENT_CONTAINER_EL = document.querySelector('.nh-content');
    LYRICS_LOADER_EL = document.body.querySelector('#nh-lyrics-loader')

    LYRICS_CLOSE_EL = LYRICS_CONTAINER_EL.querySelector('.nh-lyrics__close')
    LYRICS_ALBUM_COVER_EL = LYRICS_CONTAINER_EL.querySelector('.nh-lyrics__album-cover')
    LYRICS_SONG_NAME_EL = LYRICS_CONTAINER_EL.querySelector('.nh-lyrics__song-name')
    LYRICS_ALBUM_NAME_EL = LYRICS_CONTAINER_EL.querySelector('.nh-lyrics__album-name')
    LYRICS_ARTIST_NAME_EL = LYRICS_CONTAINER_EL.querySelector('.nh-lyrics__artist-name')
    LYRICS_LYRICS_EL = LYRICS_CONTAINER_EL.querySelector('.nh-lyrics__lyrics')

    TEMPLATE_SUGGESTION_PAGE = document.querySelector('#nht-suggestion-page')
    TEMPLATE_SUGGESTION_CARD = document.querySelector('#nht-suggestion-card')
    TEMPLATE_SUGGESTION_PAGE_DUMMY = document.querySelector('#nht-suggestion-page-dummy')
    TEMPLATE_SUGGESTION_PAGE_NOT_FOUND = document.querySelector('#nht-suggestion-page-not-found')
    TEMPLATE_SUGGESTION_CARD_DUMMY = document.querySelector('#nht-suggestion-card-dummy')



    
  }


  //======================================================================================================================

  //  State

  //======================================================================================================================

  const state = {
    pageHead: null, //head page of linked-list of pages
    searchValue: ''
  }

  function addSuggestionsPage(URL) {
    state.pageHead = new SuggestionPage(URL);
  }

  function clearSuggestionsPage() {
    PAGES_CONTAINER_EL.classList.remove(CLASS_SHOW_PAGES_CONTAINER);
    if (state.pageHead) {
      state.pageHead.destroy()
      state.pageHead = null
    }
  }


  //======================================================================================================================

  // All Time On Listeners

  //======================================================================================================================


  const listenToSearchInputChange = (callback) => {
    const debouncedCallback = debouncedFunc(callback, 500);
    SEARCH_EL.addEventListener('keyup', debouncedCallback);
  }


  //======================================================================================================================

  //  Search Handler

  //======================================================================================================================


  async function searchChanged() {
    const newSearchQuery = SEARCH_EL.value;

    if (newSearchQuery == state.searchValue) {
      return;
    }

    state.searchValue = newSearchQuery;
    clearSuggestionsPage();

    if (!newSearchQuery) {
      CONTENT_CONTAINER_EL.classList.remove(CLASS_SHRINK_LOGO)
      return;
    }


    PAGES_CONTAINER_EL.classList.add(CLASS_SHOW_PAGES_CONTAINER);
    CONTENT_CONTAINER_EL.classList.add(CLASS_SHRINK_LOGO)
    const URL = `${SUGGESTION_BASEURL}/${newSearchQuery}`
    addSuggestionsPage(URL);
  }


  //======================================================================================================================

  //  Suggestion Page

  //======================================================================================================================


  class SuggestionPage {

    _pageEl = null
    _pageCards = []
    _pageHeight = null
    _pageWidth = null
    _dummyEl = null
    _intersectionObserver = null
    _pageDetails = null
    _nextPage = null
    _pageURL = null
    _pageLoaderEl = null
    _NEXT_PAGE_INDICATOR_AFTER = 0.75
    _NUMBER_OF_DUMMY_CARDS_IN_PAGE_LOADERS = 12



    constructor(pageURL) {
      this._addPage(pageURL);
      this._pageURL = pageURL; //only for testing, use API's nextPageURL to load the next page
    }



    async _addPage(pageURL) {
      this._pageDetails = await this._fetchPageSuggestions(pageURL);

      const doesPageHasSongs = Boolean(this._pageDetails.songs.length);

      if (!doesPageHasSongs) {
        this._addPageNotFound();
        return;
      }

      const pageEl = cloneNodeFromTemplate(TEMPLATE_SUGGESTION_PAGE);

      this._addSongCards(pageEl, this._pageDetails.songs);
      PAGES_CONTAINER_EL.insertBefore(pageEl, null);
      this._pageEl = pageEl;
      this._listenToInteresectionObserver();
    }


    _addSongCards(pageEl, songs) {
      const nextPageIndicatorAtIndex = Math.round(songs.length * this._NEXT_PAGE_INDICATOR_AFTER)

      songs.forEach((song, index) => {
        const shouldAddNextPageIndicator = index == nextPageIndicatorAtIndex;
        const card = new SuggestionCard(song, shouldAddNextPageIndicator ? this._addNextPage.bind(this) : null);
        pageEl.insertBefore(card.getCardEl(), null);
        this._pageCards.push(card);
      })
    }


    _addPageNotFound() {
      const pageEl = cloneNodeFromTemplate(TEMPLATE_SUGGESTION_PAGE_NOT_FOUND)
      PAGES_CONTAINER_EL.insertBefore(pageEl, null);
      this._pageEl = pageEl;
    }



    _listenToInteresectionObserver() {
      let options = {
        root: null, //browser viewport
        rootMargin: '100px',
      }

      this._intersectionObserver = new IntersectionObserver(this._handleIntersectionObserver.bind(this), options);
      this._intersectionObserver.observe(this._pageEl);
    }



    _handleIntersectionObserver([pageObserverEntry]) {

      this._pageHeight = pageObserverEntry.boundingClientRect.height;
      this._pageWidth = pageObserverEntry.boundingClientRect.width;

      const isPageVisible = pageObserverEntry.isIntersecting;

      if (isPageVisible) {
        this._dummyEl && this._unDummifyPage();
      }
      else {
        !this._dummyEl && this._dummifyPage();
      }
    }



    async _fetchPageSuggestions(URL) {
      this._togglePageLoaders(true);
      const result = await fetchRequest(URL);
      this._togglePageLoaders(false);
      return {
        songs: result.data.map(suggestionsResponseParser),
        nextPageURL: this._pageURL,//result.next,
        totalSongs: result.total
      }
    }



    _togglePageLoaders(showLoader) { //true or false
      if (showLoader) {
        this._pageLoaderEl = cloneNodeFromTemplate(TEMPLATE_SUGGESTION_PAGE);

        for (let i = 0; i < this._NUMBER_OF_DUMMY_CARDS_IN_PAGE_LOADERS; i++) {
          const cardEl = SuggestionCard.createDummyCard();
          this._pageLoaderEl.insertBefore(cardEl, null);
        }

        PAGES_CONTAINER_EL.insertBefore(this._pageLoaderEl, null);
      }
      else {
        this._pageLoaderEl && PAGES_CONTAINER_EL.removeChild(this._pageLoaderEl);
        this._pageLoaderEl = null;
      }
    }



    _addNextPage() {
      const canFetchNextPage = !this._nextPage && !this._pageLoaderEl; // no next page && not loading current page

      if (canFetchNextPage) {
        this._nextPage = new SuggestionPage(this._pageURL)
        // this._nextPage = new SuggestionPage(this._pageDetails.next) // Ask Satyam for API 
      }
    }



    _dummifyPage() { //remove content, but maintain scrollHeight
      this._dummyEl = cloneNodeFromTemplate(TEMPLATE_SUGGESTION_PAGE_DUMMY);
      this._dummyEl.style.height = this._pageHeight + 'px';
      // this._dummyEl.style.width = this._pageWidth + 'px';

      PAGES_CONTAINER_EL.insertBefore(this._dummyEl, this._pageEl);
      PAGES_CONTAINER_EL.removeChild(this._pageEl);

      this._intersectionObserver.unobserve(this._pageEl);
      this._intersectionObserver.observe(this._dummyEl);
    }



    _unDummifyPage() { //remove dummyPage and add actual page
      PAGES_CONTAINER_EL.insertBefore(this._pageEl, this._dummyEl);
      PAGES_CONTAINER_EL.removeChild(this._dummyEl);

      this._intersectionObserver.unobserve(this._dummyEl);
      this._intersectionObserver.observe(this._pageEl);

      this._dummyEl = null;
    }



    destroy() {

      this._nextPage && this._nextPage.destroy();
      this._dummyEl && PAGES_CONTAINER_EL.removeChild(this._dummyEl);
      this._pageLoaderEl && PAGES_CONTAINER_EL.removeChild(this._pageLoaderEl);
      !this._dummyEl && this._pageEl && PAGES_CONTAINER_EL.removeChild(this._pageEl);

      this._intersectionObserver && this._intersectionObserver.disconnect();

      this._pageEl = null;
      this._dummyEl = null;
      this._pageLoaderEl = null;

      this._pageCards.forEach(card => {
        card.destroy();
      })

      this._pageCards = [];
    }

  }


  //======================================================================================================================

  //  Suggestion Card

  //======================================================================================================================


  class SuggestionCard {

    _cardEl
    _song
    _clickHandler
    _intersectionObserver


    constructor(song, intersectionCallback) {
      this._song = { ...song };
      this._clickHandler = debouncedFunc(this._cardClicked.bind(this), 300);
      this.createCard(song);

      if (intersectionCallback) {
        this._listenToInteresectionObserver(intersectionCallback);
      }
    }


    static createDummyCard() { 
      return cloneNodeFromTemplate(TEMPLATE_SUGGESTION_CARD_DUMMY);
    }


    createCard(song) {
      this._cardEl = cloneNodeFromTemplate(TEMPLATE_SUGGESTION_CARD);

      const albumCover = this._cardEl.querySelector('.nh-card__album-cover.nh-cover');
      albumCover.src = song.album.picture;
      albumCover.alt = song.album.name.substr(0, 10);


      const artistCover = this._cardEl.querySelector('.nh-card__artist-cover.nh-cover');
      artistCover.src = song.artist.picture;
      artistCover.alt = song.artist.name.substr(0, 10);

      this._cardEl.querySelector('.nh-card__song-name').innerText = song.name;
      this._cardEl.querySelector('.nh-card__artist-name').innerText = song.artist.name;

      this._listenToClick();
    }



    getCardEl() {
      return this._cardEl;
    }



    async _cardClicked() {
      showLyricsLoader(true);
      const { lyrics } = await fetchLyrics(this._song.artist.name, this._song.name);
      showLyricsLoader(false);
      showLyrics(this._song, lyrics)
    }



    _listenToInteresectionObserver(intersectionCallback) {
      this._intersectionObserver = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          this._intersectionObserver.unobserve(this._cardEl);
          this._intersectionObserver.disconnect();
          this._intersectionObserver = null;
          intersectionCallback();
        }
      });

      this._intersectionObserver.observe(this._cardEl);
    }



    _listenToClick() {
      this._cardEl.addEventListener('click', this._clickHandler);
    }



    _stopListenToClick() {
      this._cardEl.removeEventListener('click', this._clickHandler);
    }



    destroy() {
      this._stopListenToClick();
      this._cardEl = null
    }
  }



  //======================================================================================================================

  //  Lyrics Dialog

  //======================================================================================================================

  function showLyrics(song, lyrics) {
    LYRICS_CONTAINER_EL.classList.add(CLASS_SHOW_LYRICS);

    LYRICS_CLOSE_EL.addEventListener('click', removeLyrics);
    LYRICS_CONTAINER_EL.addEventListener('click', removeLyrics);

    setLyricsToView(song, lyrics);
  }



  function removeLyrics(mouseEvent) {
    if (mouseEvent.target !== this) {
      return;
    }

    LYRICS_CONTAINER_EL.classList.remove(CLASS_SHOW_LYRICS);

    LYRICS_CLOSE_EL.removeEventListener('click', removeLyrics);
    LYRICS_CONTAINER_EL.removeEventListener('click', removeLyrics);

    setLyricsToView(null, null);
  }



  function showLyricsLoader(show) {
    if (show) {
      LYRICS_LOADER_EL.classList.add(CLASS_SHOW_LYRICS_LOADER)
    }
    else {
      LYRICS_LOADER_EL.classList.remove(CLASS_SHOW_LYRICS_LOADER)
    }
  }



  function setLyricsToView(song, lyrics) {
    LYRICS_ALBUM_COVER_EL.src = song ? song.album.picture : '';
    LYRICS_ALBUM_COVER_EL.alt = song ? song.name : '';
    LYRICS_SONG_NAME_EL.innerText = song ? 'Song: ' + song.name : '';
    LYRICS_ALBUM_NAME_EL.innerText = song ? 'Album: ' + song.album.name : '';
    LYRICS_ARTIST_NAME_EL.innerText = song ? 'Artist: ' + song.artist.name : '';

    if (lyrics) {
      LYRICS_LYRICS_EL.innerText = lyrics
    }
    else {
      LYRICS_LYRICS_EL.innerText = 'Oops... No Lyrics Found.'
    }
  }




  //======================================================================================================================

  //  Fetch

  //======================================================================================================================


  let requestController;

  async function fetchRequest(url, noAbort) {
    try {

      let signal;

      if (!noAbort) {
        if (requestController) {
          requestController.abort();
        }

        requestController = new AbortController();
        signal = requestController.signal;
      }

      return await (await fetch(url, { signal })).json();
    }
    catch (e) {
      throw e;
    }
  }

  async function fetchLyrics(artistName, songName) {
    const noAbort = true;
    return await fetchRequest(`${LYRICS_BASEURL}/${artistName}/${songName}`, noAbort)
  }


  //======================================================================================================================

  //  Utils

  //======================================================================================================================


  function cloneNodeFromTemplate(template) {
    return template.content.firstElementChild.cloneNode(true);
  }

  function debouncedFunc(func, timeInMS) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func(...args);
      }, timeInMS);
    }
  }

  function suggestionsResponseParser(song) {
    return {
      id: song.id,
      name: song.title_short,
      preview: song.preview,
      album: {
        id: song.album && song.album.id,
        name: song.album && song.album.title,
        picture: song.album && song.album.cover,
        pictureS: song.album && song.album.cover_small,
        pictureXL: song.album && song.album.cover_xl,
      },
      artist: {
        id: song.artist && song.artist.id,
        name: song.artist && song.artist.name,
        picture: song.artist && song.artist.picture,
        pictureS: song.artist && song.artist.picture_small,
        pictureXL: song.artist && song.artist.picture_xl,
      }
    }
  }

})();



