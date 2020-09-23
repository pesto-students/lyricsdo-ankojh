//  Author: ankojh


(async function () {

  //======================================================================================================================

  //  CONSTANTS

  //======================================================================================================================


  const LYRICS_BASEURL = 'https://api.lyrics.ovh/v1'
  const SUGGESTION_BASEURL = 'https://api.lyrics.ovh/suggest'




  //constants defined after load
  let PAGES_CONTAINER_EL;
  let SEARCH_EL;
  let CONTENT_CONTAINER;
  let LYRICS_CONTAINER;
  let TEMPLATE_SUGGESTION_PAGE;
  let TEMPLATE_SUGGESTION_PAGE_NOT_FOUND;
  let TEMPLATE_SUGGESTION_CARD;
  let TEMPLATE_SUGGESTION_PAGE_DUMMY;


  //======================================================================================================================

  //  INIT

  //======================================================================================================================



  window.onload = function () {
    fetchDomRefs();
    listenToSearchInputChange(searchChanged);
  }


  function fetchDomRefs() {
    PAGES_CONTAINER_EL = document.body.querySelector('#nh-suggestions-pages-container')
    SEARCH_EL = document.querySelector('#nh-song-search');
    LYRICS_CONTAINER = document.querySelector('#nh-lyrics');
    CONTENT_CONTAINER = document.querySelector('.nh-content')


    TEMPLATE_SUGGESTION_PAGE = document.querySelector('#nht-suggestion-page')
    TEMPLATE_SUGGESTION_CARD = document.querySelector('#nht-suggestion-card')
    TEMPLATE_SUGGESTION_PAGE_DUMMY = document.querySelector('#nht-suggestion-page-dummy')
    TEMPLATE_SUGGESTION_PAGE_NOT_FOUND = document.querySelector('#nht-suggestion-page-not-found')
  }


  //======================================================================================================================

  //  State

  //======================================================================================================================

  const state = {
    pageHead: null,
    searchValue: ''
  }

  function addSuggestionsPage(URL) {
    state.pageHead = new SuggestionPage(URL);
  }

  function clearSuggestionsPage() {
    PAGES_CONTAINER_EL.style.visibility = 'hidden';
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

  //  Search

  //======================================================================================================================


  async function searchChanged() {
    const searchQuery = SEARCH_EL.value;

    if (searchQuery == state.searchValue) {
      return;
    }

    state.searchValue = searchQuery;

    clearSuggestionsPage();

    if (!searchQuery) {
      CONTENT_CONTAINER.classList.remove('ng-shrink')
      return;
    }

    const URL = `${SUGGESTION_BASEURL}/${searchQuery}`
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



    constructor(pageURL) {
      this._addPage(pageURL);
      this._pageURL = pageURL; //only for testing,use nextpageurl to load next page
    }



    async _addPage(pageURL) {
      PAGES_CONTAINER_EL.style.visibility = 'visible'; // todo
      CONTENT_CONTAINER.classList.add('ng-shrink')  // todo

      await this._fetchPage(pageURL);
      if(!this._pageDetails.songs.length){
        const pageEl = TEMPLATE_SUGGESTION_PAGE_NOT_FOUND.content.firstElementChild.cloneNode(true);
        PAGES_CONTAINER_EL.insertBefore(pageEl, null);
        this._pageEl = pageEl;
        return;
      }

      const pageEl = TEMPLATE_SUGGESTION_PAGE.content.firstElementChild.cloneNode(true);
      pageEl.classList.add('nh-suggestion-page')

      const nextPageIndicatorAtIndex = Math.round(this._pageDetails.songs.length * this._NEXT_PAGE_INDICATOR_AFTER)

      this._pageDetails.songs.forEach((song, index) => {
        let isIndicator = index == nextPageIndicatorAtIndex;
        const card = new SuggestionCard(song, isIndicator ? this._fetchNextPage.bind(this) : null);
        pageEl.insertBefore(card.getCardEl(), null);
        this._pageCards.push(card);
      })

      PAGES_CONTAINER_EL.insertBefore(pageEl, null);
      this._pageEl = pageEl;
      this._listenToInteresectionObserver();
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

      this._pageHeight = pageObserverEntry.boundingClientRect.height; //setting it again to handle window resize.
      this._pageWidth = pageObserverEntry.boundingClientRect.width;

      if (pageObserverEntry.isIntersecting) {
        this._dummyEl && this._unDummifyPage();
      }
      else {
        !this._dummyEl && this._dummifyPage();
      }
    }



    _togglePageLoaders(showLoader) { //true or false
      if (showLoader) {
        this._pageLoaderEl = TEMPLATE_SUGGESTION_PAGE.content.firstElementChild.cloneNode(true);

        for (let i = 0; i < 12; i++) { // why create it all the time??? but why store all the time, we don't neet it always?
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



    async _fetchPage(URL) {
      this._togglePageLoaders(true);
      const result = await fetchRequest(URL);
      this._togglePageLoaders(false);
      this._pageDetails = {
        songs: result.data.map(suggestionsResponseParser),
        nextPageURL: this._pageURL,//result.next,
        totalSongs: result.total
      }
    }



    _fetchNextPage() {
      if (!this._nextPage && !this._pageLoaderEl) { // no next page && not loading current page
        this._nextPage = new SuggestionPage(this._pageURL)
        // this._nextPage = new SuggestionPage(this._pageDetails.next) // Ask Satyam for API 
      }
    }



    _dummifyPage() { //remove content, but maintain scrollHeight
      this._dummyEl = TEMPLATE_SUGGESTION_PAGE_DUMMY.content.firstElementChild.cloneNode(true);
      this._dummyEl.style.height = this._pageHeight + 'px';
      this._dummyEl.style.width = this._pageWidth + 'px';

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

      if(intersectionCallback){
        this._listenToInteresectionObserver(intersectionCallback);
      }
    }


    static createDummyCard(){
      const dummyCardEl = document.createElement('div');
      dummyCardEl.classList.add('nh-suggestion-card');
      dummyCardEl.classList.add('nh-card-dummy');
      return dummyCardEl;
    }


    createCard(song) {
      this._cardEl = TEMPLATE_SUGGESTION_CARD.content.firstElementChild.cloneNode(true);

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
      lyricsLoader(true);
      const { lyrics } = await fetchLyrics(this._song.artist.name, this._song.name);
      lyricsLoader(false);
      showLyrics(this._song, lyrics)
    }



    _listenToInteresectionObserver(intersectionCallback){
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

  function showLyrics(song, lyrics){
    LYRICS_CONTAINER.classList.add('show__lyrics');
    LYRICS_CONTAINER.querySelector('.nh-lyrics__close').addEventListener('click', removeLyrics); 
    LYRICS_CONTAINER.addEventListener('click', removeLyrics);

    setLyricsToView(song, lyrics);
  }


  function removeLyrics(mouseEvent) { 

    if (mouseEvent.target !== this) {
      return;
    }

    LYRICS_CONTAINER.classList.remove('show__lyrics');
    LYRICS_CONTAINER.querySelector('.nh-lyrics__close').removeEventListener('click', removeLyrics);
    LYRICS_CONTAINER.removeEventListener('click', removeLyrics);
    
    setLyricsToView(null, null);
  }



  function lyricsLoader(show) { //refactor this
    if (show) {
      document.body.querySelector('#nh-lyrics-loader').style.display = 'flex';
    }
    else {
      document.body.querySelector('#nh-lyrics-loader').style.display = 'none';
    }
  }



  function setLyricsToView(song, lyrics){
    LYRICS_CONTAINER.querySelector('.nh-lyrics__album-cover').src = song ? song.album.pictureXL : '';
    LYRICS_CONTAINER.querySelector('.nh-lyrics__song-name').innerText = song ? 'Song: ' + song.name : '';
    LYRICS_CONTAINER.querySelector('.nh-lyrics__album-name').innerText = song ? 'Album: ' + song.album.name : '';
    LYRICS_CONTAINER.querySelector('.nh-lyrics__artist-name').innerText = song ? 'Artist: ' + song.artist.name : '';

    if (lyrics) {
      LYRICS_CONTAINER.querySelector('.nh-lyrics__lyrics').innerText = lyrics
    }
    else {
      LYRICS_CONTAINER.querySelector('.nh-lyrics__lyrics').innerText = 'Oops... No Lyrics Found.'
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
     return await fetchRequest(`${LYRICS_BASEURL}/${artistName}/${songName}`, true)
  }


  //======================================================================================================================

  //  Utils

  //======================================================================================================================

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



