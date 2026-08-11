export type Locale = "en" | "ar" | "fr";

export interface Messages {
  common: {
    save: string;
    saving: string;
    cancel: string;
    close: string;
    delete: string;
    archive: string;
    create: string;
    join: string;
    leave: string;
    copy: string;
    retry: string;
    back: string;
    tryAgain: string;
    confirm: string;
    loading: string;
    code: string;
    players: string;
    points: string;
    finished: string;
    cancelled: string;
    running: string;
    waiting: string;
    paused: string;
    noGamesYet: string;
    noResults: string;
    loadFailedTitle: string;
    loadFailedDesc: string;
draft: string;
    scheduled: string;
    reset: string;
    questionWord: string;
      answerWord: string;
      avg: string;
      errorTitle: string;
      errorDesc: string;
    };
  nav: {
    home: string;
    about: string;
    myQuizzes: string;
    liveGames: string;
    classes: string;
    analytics: string;
    newQuiz: string;
    dashboard: string;
    history: string;
    joinGame: string;
    logIn: string;
    signOut: string;
    host: string;
    toggle: string;
    main: string;
    mobile: string;
  };
  landing: {
    heroTitle: string;
    heroSubtitle: string;
    hostQuiz: string;
    rolesHeading: string;
    hostTitle: string;
    hostDescription: string;
    startHosting: string;
    joinTitle: string;
    joinDescription: string;
    enterCode: string;
    stepsHeading: string;
    step1Title: string;
    step1Description: string;
    step2Title: string;
    step2Description: string;
    step3Title: string;
    step3Description: string;
  };
  about: {
    title: string;
    p1: string;
    p2: string;
    p3: string;
  };
  auth: {
    welcomeBack: string;
    logInSub: string;
    email: string;
    password: string;
    createAccount: string;
    registerSub: string;
    name: string;
    iAmHost: string;
    iAmStudent: string;
    alreadyHaveAccount: string;
    noAccount: string;
    forgotLink: string;
    needAccount: string;
    signIn: string;
    signUp: string;
    invalidCredentials: string;
    notConfigured: string;
    couldNotSignIn: string;
    serverUnreachable: string;
    accountCreatedTitle: string;
    accountCreatedDesc: string;
    nameTooShort: string;
    passwordTooShort: string;
    passwordsDoNotMatch: string;
    accountType: string;
    hostDescription: string;
    studentDescription: string;
    confirmPassword: string;
    minCharsHint: string;
  };
  join: {
    title: string;
    subtitle: string;
    nickname: string;
    nicknamePlaceholder: string;
    gameCode: string;
    gameCodePlaceholder: string;
    joinButton: string;
    nickError: string;
    codeError: string;
    notOpenError: string;
    draftError: string;
    classCodeError: string;
    classCodeNeedsLogin: string;
    genericErrorTitle: string;
    genericErrorDesc: string;
  };
  student: {
    progress: string;
    progressSub: string;
    gamesPlayed: string;
    joined: string;
    avgScore: string;
    avgAccuracy: string;
    bestScore: string;
    recentGames: string;
    noGamesTitle: string;
    noGamesDesc: string;
    historyTitle: string;
    historySub: string;
    correctOf: string;
    pts: string;
    myClasses: string;
    myClassesSub: string;
    joinClass: string;
    joinClassSub: string;
    classCode: string;
    classCodePlaceholder: string;
    joinClassButton: string;
    classCodeError: string;
    classNotOpen: string;
    classJoined: string;
    classLeft: string;
    noClassesTitle: string;
    noClassesDesc: string;
    members: string;
signInToTrack: string;
      classJoinedDesc: string;
      classJoinFailed: string;
      classLeftDesc: string;
      classLeaveFailed: string;
      classesLoadFailed: string;
    };
  host: {
    myGamesTitle: string;
    myGamesSub: string;
    browseQuizzes: string;
    cancel: string;
    cancelledToastTitle: string;
    cancelledToastDesc: string;
    cancelFailed: string;
    loadFailedTitle: string;
    loadFailedDesc: string;
    openControlRoom: string;
    noGamesTitle: string;
    noGamesDesc: string;
    librarySub: string;
    searchPlaceholder: string;
    searchLabel: string;
    of: string;
    noQuizzesYet: string;
    noQuizzesDesc: string;
    noMatches: string;
    noMatchesDesc: string;
    createQuiz: string;
    duplicatedTitle: string;
    duplicatedDesc: string;
    duplicateFailed: string;
    deletedTitle: string;
    deletedDesc: string;
    deleteFailed: string;
    archivedTitle: string;
    archivedDesc: string;
    archiveFailed: string;
    deleteTitle: string;
    deleteDesc: string;
    deletePermanently: string;
    lobbyOpen: string;
    setupTitle: string;
    setupTagline: string;
    setupGameTitle: string;
    setupGameTitlePlaceholder: string;
    setupInstructions: string;
    setupInstructionsPlaceholder: string;
    setupMinutesPerQuestion: string;
    setupMinutesHint: string;
    setupSave: string;
    setupSaved: string;
    setupSaveFailed: string;
    gameNotFound: string;
    couldNotOpen: string;
    backToGames: string;
    couldNotCopy: string;
    actionFailed: string;
    gameDeleted: string;
    gameDeletedDesc: string;
    pause: string;
    startGame: string;
    endQuestionNow: string;
    nextQuestion: string;
    finishGame: string;
    resumeGame: string;
    questionOfCtrl: string;
    remaining: string;
    closed: string;
    answered: string;
    correctAnswer: string;
    noActiveQuestion: string;
    questionDeck: string;
    active: string;
    done: string;
    upcoming: string;
    results: string;
    place: string;
    perQuestionBreakdown: string;
    noQuestionData: string;
    shareCode: string;
    studentsGoJoin: string;
    playersHeading: string;
    waitingPlayers: string;
    online: string;
    away: string;
    noScoresYet: string;
    dangerZone: string;
    cancelGame: string;
    deleteGame: string;
    cancelTitle: string;
    cancelDesc: string;
    keepPlaying: string;
    deleteGameTitle: string;
    deleteGameDesc: string;
    keepIt: string;
    copied: string;
    classesTitle: string;
    classesSub: string;
    createClass: string;
    createClassSub: string;
    className: string;
    classNamePlaceholder: string;
    classDescription: string;
    classDescriptionPlaceholder: string;
    createdToast: string;
    createdToastDesc: string;
    createFailed: string;
    membersLabel: string;
    archiveLabel: string;
    archivedToast: string;
    archivedToastDesc: string;
    archiveTitle: string;
    archiveDesc: string;
    keepClass: string;
    archivedBadge: string;
    noMembers: string;
    noMembersDesc: string;
    memberRemoved: string;
    removeMemberFailed: string;
    noClassesYet: string;
    noClassesYetDesc: string;
    copyFailedDesc: string;
    membersLoadFailed: string;
    createFailedDesc: string;
    memberWord: string;
    gameWord: string;
    copyClassCode: string;
    membersJoinHint: string;
    joinedOn: string;
    removeMember: string;
    copyFailed: string;
    codeCopied: string;
    codeCopiedDesc: string;
    analyticsTitle: string;
    analyticsSub: string;
    manageGames: string;
    gamesLaunched: string;
    averageScore: string;
    averageAccuracy: string;
    avgResponseTime: string;
    mostMissed: string;
    mostMissedSub: string;
    answersCount: string;
    noAnswers: string;
    nothingMissed: string;
    nothingMissedDesc: string;
    wrongAnswers: string;
    correctPct: string;
    questions: string;
    answers: string;
    gameBadgeFinished: string;
    gameBadgeCancelled: string;
    gameBadgeRunning: string;
    gameBadgeWaiting: string;
    gameBadgePaused: string;
    loadAnalyticsFailed: string;
    loadGamesFailed: string;
    statQuestions: string;
    statAnswers: string;
    inGame: string;
    pickAnotherGame: string;
  };
  editor: {
    settings: string;
    quizName: string;
    language: string;
    category: string;
    categoryPlaceholder: string;
    difficulty: string;
    difficultyAny: string;
    difficultyEasy: string;
    difficultyMedium: string;
    difficultyHard: string;
    defaultPoints: string;
    defaultNegativePoints: string;
    classOptional: string;
    noClass: string;
    description: string;
    descriptionPlaceholder: string;
    speedBonus: string;
    questions: string;
    addQuestion: string;
    noDescription: string;
    editLabel: string;
    openLabel: string;
    duplicateAction: string;
      createQuiz: string;
      createSub: string;
      quizNamePlaceholder: string;
      createAndAdd: string;
      quizCreated: string;
      quizCreatedDesc: string;
      createFailed: string;
      quizNameRequired: string;
    saveChanges: string;
    savedToastTitle: string;
    savedToastDesc: string;
    saveFailed: string;
    launchGame: string;
    launchToastTitle: string;
    launchToastDesc: string;
    launchFailed: string;
    launchDialogTitle: string;
    launchDialogDesc: string;
    launchDialogKeep: string;
    launchDialogConfirm: string;
    deleteQuestion: string;
    preview: string;
    backToLibrary: string;
    exitEditing: string;
    exitConfirmTitle: string;
    exitConfirmDesc: string;
    exitConfirmKeep: string;
    exitConfirmLeave: string;
    typeLabel: string;
    typeMcq: string;
    typeTrueFalse: string;
    typeText: string;
    typeNumber: string;
    typeAudio: string;
    questionText: string;
    questionTextPlaceholder: string;
    choices: string;
    choiceLabel: string;
    addChoice: string;
    correctAnswer: string;
    markCorrect: string;
    duration: string;
    seconds: string;
    pointsPerQuestion: string;
      default: string;
    negativePoints: string;
    explanation: string;
    explanationPlaceholder: string;
    surahRef: string;
    surah: string;
    ayah: string;
    page: string;
    juz: string;
    hizb: string;
    missingText: string;
    missingChoices: string;
    missingTwoChoices: string;
    missingCorrectMarker: string;
    missingCorrectText: string;
    missingDuration: string;
    missingPoints: string;
    errorSummary: string;
    notDraftLocked: string;
    moveUp: string;
moveDown: string;
      loadTitle: string;
      loadNotFound: string;
      loadFailed: string;
      backToQuizzes: string;
      checkErrors: string;
      checkErrorsDesc: string;
      saveFailedTitle: string;
      launchFailedTitle: string;
      untitledQuiz: string;
      untitledQuestion: string;
      unsaved: string;
      discard: string;
      addQuestionsFirst: string;
      launched: string;
      backToEditing: string;
      incomplete: string;
      launchDialogLocked: string;
      onlyOneCorrect: string;
      chooseCorrect: string;
      optionsMark: string;
      markOptionAria: string;
      removeOptionAria: string;
      optionWord: string;
      addOption: string;
      trueOption: string;
      falseOption: string;
      correctNumeric: string;
      correctTextHint: string;
      expected: string;
    };
  game: {
    lobbyTitle: string;
    lobbySub: string;
    waitingForPlayers: string;
    startingSoon: string;
    gameEnded: string;
    leaveLobby: string;
    playerCount: string;
    questionTitle: string;
    waitingForQuestion: string;
    pausedOverlay: string;
    pausedOverlayDesc: string;
    submitAnswer: string;
    answerLocked: string;
    skipped: string;
    correct: string;
    wrong: string;
    feedback: string;
    youAnswered: string;
    correctAnswerIs: string;
    explanation: string;
    next: string;
    resultTitle: string;
    yourScore: string;
    yourRank: string;
    ofPlayers: string;
    leaderboard: string;
    podium: string;
    yourAnswers: string;
    timeUp: string;
    answerNow: string;
    kbdChoice: string;
    networkError: string;
    retryJoin: string;
    sessionExpired: string;
    backToLobby: string;
    answeredCount: string;
    playersAnswered: string;
    connecting: string;
    connectError: string;
    notAvailableTitle: string;
    notAvailableDesc: string;
    you: string;
    questionOf: string;
    scoreLabel: string;
    pickAnswerError: string;
    questionClosedError: string;
    sendAnswerFailed: string;
    gettingReady: string;
    hostAboutToStart: string;
    answerSubmitted: string;
    waitingTimer: string;
    wrongAnswer: string;
    noAnswerSubmitted: string;
    youPickedThis: string;
    why: string;
    revealingAnswer: string;
    loadingResults: string;
    gameEndedTitle: string;
    leaveGame: string;
    answerChoicesLabel: string;
    typeNumber: string;
    typeAnswer: string;
    gameStillRunning: string;
    resultsAfterFinish: string;
    backToGame: string;
    gameFinishedTitle: string;
    yourResultIntro: string;
    returnHome: string;
    firstPlace: string;
    secondPlace: string;
    thirdPlace: string;
  };
}

export const messages: Record<Locale, Messages> = {
  en: {
    common: {
      save: "Save",
      saving: "Saving…",
      cancel: "Cancel",
      close: "Close",
      delete: "Delete",
      archive: "Archive",
      create: "Create",
      join: "Join",
      leave: "Leave",
      copy: "Copy",
      retry: "Retry",
      back: "Back",
      tryAgain: "Try again",
      confirm: "Confirm",
      loading: "Loading…",
      code: "Code",
      players: "players",
      points: "pts",
      finished: "Finished",
      cancelled: "Cancelled",
      running: "Running",
      waiting: "Waiting",
      paused: "Paused",
      noGamesYet: "No games yet",
      noResults: "No results",
      loadFailedTitle: "Couldn't load this page",
      loadFailedDesc: "Check your connection and try again.",
      draft: "Draft",
      scheduled: "Scheduled",
      reset: "Reset",
      questionWord: "questions",
      answerWord: "answers",
      avg: "avg",
      errorTitle: "Something went wrong",
      errorDesc: "An unexpected error occurred while rendering this section.",
    },
    nav: {
      home: "Home",
      about: "About",
      myQuizzes: "My Quizzes",
      liveGames: "Live Games",
      classes: "Classes",
      analytics: "Analytics",
      newQuiz: "New Quiz",
      dashboard: "Dashboard",
      history: "History",
      joinGame: "Join a Game",
      logIn: "Log in",
      signOut: "Sign out",
      host: "Host",
      toggle: "Toggle navigation",
      main: "Main navigation",
      mobile: "Mobile navigation",
    },
    landing: {
      heroTitle: "Live quizzes, made for the classroom",
      heroSubtitle:
        "Host real-time quiz rounds with your students, or join a game with a code. No downloads, no setup — just questions, answers, and a live leaderboard.",
      hostQuiz: "Host a quiz",
      rolesHeading: "Choose your experience",
      hostTitle: "Host a quiz",
      hostDescription:
        "Create a quiz, start a live game, and watch the leaderboard update in real time.",
      startHosting: "Start hosting",
      joinTitle: "Join a game",
      joinDescription:
        "Enter the code your teacher shared, pick a nickname, and play live on any device.",
      enterCode: "Enter a code",
      stepsHeading: "How it works",
      step1Title: "Create or open a quiz",
      step1Description: "Build your questions, or pick an existing quiz from your library.",
      step2Title: "Share the game code",
      step2Description: "Students join the lobby with the code on their phones.",
      step3Title: "Play in real time",
      step3Description: "Questions appear for everyone at once. Scores update live.",
    },
    about: {
      title: "About the platform",
      p1: "Quran Quiz Platform is a real-time educational quiz tool. Teachers create quizzes and host live games with a shared join code; students answer on their own devices while scores and the leaderboard update instantly.",
      p2: "The platform is being prepared for Arabic-first content, including Quran memorization questions with surah and ayah references, with full right-to-left support.",
      p3: "Everything runs on Supabase — authentication, the database, and realtime updates — so questions, answers, and game state stay in sync without extra infrastructure.",
    },
    auth: {
      welcomeBack: "Welcome back",
      logInSub: "Sign in to manage your quizzes and games.",
      email: "Email",
      password: "Password",
      createAccount: "Create account",
      registerSub: "Pick a role to get started.",
      name: "Full name",
      iAmHost: "I'm a host (teacher)",
      iAmStudent: "I'm a student",
      alreadyHaveAccount: "Already have an account?",
      noAccount: "Don't have an account?",
      forgotLink: "Forgot password?",
      needAccount: "Need an account?",
      signIn: "Sign in",
      signUp: "Create account",
      invalidCredentials: "Invalid email or password. Please try again.",
      notConfigured: "Supabase is not configured on this deployment.",
      couldNotSignIn: "Could not sign in.",
      serverUnreachable: "Could not reach the server. Check your connection and try again.",
      accountCreatedTitle: "Account created",
      accountCreatedDesc: "Signing you in…",
      nameTooShort: "Name must be at least 2 characters.",
      passwordTooShort: "Password must be at least 6 characters.",
      passwordsDoNotMatch: "Passwords do not match.",
      accountType: "Account type",
      hostDescription: "Create quizzes and run live games",
      studentDescription: "Join games and track progress",
      confirmPassword: "Confirm password",
      minCharsHint: "At least 6 characters.",
    },
    join: {
      title: "Join a game",
      subtitle: "Enter a game or class code your teacher shared, then pick a nickname.",
      nickname: "Your nickname",
      nicknamePlaceholder: "e.g. Ahmed",
      gameCode: "Code",
      gameCodePlaceholder: "e.g. A1B2C3D4",
      joinButton: "Join game",
      nickError: "Nickname must be between 2 and 50 characters.",
      codeError: "Enter the game code shown by the host.",
      notOpenError: "This game isn't open to join yet. Check the code with your host.",
      draftError:
        "This quiz hasn't been launched yet. Ask your host to launch it from their quiz library — drafts can't be joined.",
      classCodeError:
        "That's a class code, not a game code. Join the class from your Classes page — live games use the code shown in the host's control room.",
      classCodeNeedsLogin:
        "Class codes need a signed-in account. Log in, then join the class from your Classes page.",
      genericErrorTitle: "Couldn't join the game",
      genericErrorDesc: "Check your connection and try again.",
    },
    student: {
      progress: "My progress",
      progressSub:
        "Your game history follows your account — sign in before joining to track it.",
      gamesPlayed: "Games played",
      joined: "joined",
      avgScore: "Average score",
      avgAccuracy: "Average accuracy",
      bestScore: "Best score",
      recentGames: "Recent games",
      noGamesTitle: "No games yet",
      noGamesDesc:
        "Join a live game with the code your host shows — results will appear here.",
      historyTitle: "Game history",
      historySub: "Every game you joined while signed in, with your score and accuracy.",
      correctOf: "correct",
      pts: "pts",
      myClasses: "My classes",
      myClassesSub: "Join with the code your teacher shares to stay in their group.",
      joinClass: "Join a class",
      joinClassSub: "Enter the class code your teacher shared.",
      classCode: "Class code",
      classCodePlaceholder: "e.g. SBJ2S9YY",
      joinClassButton: "Join class",
      classCodeError: "Enter the class code your teacher shared.",
      classNotOpen: "That class code isn't open right now. Check with your teacher.",
      classJoined: "Class joined",
      classLeft: "Class left",
      noClassesTitle: "No classes yet",
      noClassesDesc: "Ask your teacher for the class code and enter it above.",
      members: "members",
      signInToTrack: "Sign in to track your progress",
      classJoinedDesc: "You can now see your class here.",
      classJoinFailed: "Couldn't join the class",
      classLeftDesc: "{name} was removed from your list.",
      classLeaveFailed: "Couldn't leave the class",
      classesLoadFailed: "Couldn't load your classes",
    },
    host: {
      myGamesTitle: "Live games",
      myGamesSub: "Games you launched. Open a control room to run a round.",
      browseQuizzes: "Browse quizzes",
      cancel: "Cancel",
      cancelledToastTitle: "Game cancelled",
      cancelledToastDesc: "was stopped.",
      cancelFailed: "Could not cancel",
      loadFailedTitle: "Couldn't load your games",
      loadFailedDesc: "Check your connection and try again.",
      openControlRoom: "Open control room",
      noGamesTitle: "No games yet",
      noGamesDesc:
        "Pick a quiz from your library and launch it — students join with the room code.",
      librarySub: "Build and organize quizzes, then launch them as live games.",
      searchPlaceholder: "Search by name, code or category…",
      searchLabel: "Search quizzes",
      of: "of",
      noQuizzesYet: "No quizzes yet",
      noQuizzesDesc:
        "Create your first quiz — questions, scoring and Quran references are all editable.",
      noMatches: "No matches",
      noMatchesDesc: "Try a different search term.",
      createQuiz: "Create a quiz",
      duplicatedTitle: "Quiz duplicated",
      duplicatedDesc: "Open the copy to edit it.",
      duplicateFailed: "Duplicate failed",
      deletedTitle: "Quiz deleted",
      deletedDesc: "“{name}” was removed.",
      deleteFailed: "Delete failed",
      archivedTitle: "Quiz archived",
      archivedDesc: "Moved out of the active library.",
      archiveFailed: "Archive failed",
      deleteTitle: "Delete this quiz?",
      deleteDesc:
        "“{name}” and its {count} question(s) will be permanently removed.",
      deletePermanently: "Delete permanently",
      lobbyOpen: "Lobby open",
      setupTitle: "Game setup",
      setupTagline:
        "Set the game title students see, optional instructions, and how long each question stays open.",
      setupGameTitle: "Game title",
      setupGameTitlePlaceholder: "e.g. Quran night round 2",
      setupInstructions: "Instructions (optional)",
      setupInstructionsPlaceholder: "Shown to students while they wait in the lobby…",
      setupMinutesPerQuestion: "Time per question (minutes)",
      setupMinutesHint: "Questions longer than this limit are shortened to it when they start.",
      setupSave: "Save setup",
      setupSaved: "Setup saved",
      setupSaveFailed: "Couldn't save the setup",
      gameNotFound: "Game not found. Check the room code.",
      couldNotOpen: "Could not open this game.",
      backToGames: "Back to games",
      couldNotCopy: "Could not copy the code.",
      actionFailed: "Action failed",
      gameDeleted: "Game deleted",
      gameDeletedDesc: "All rounds and players were removed.",
      pause: "Pause",
      startGame: "Start game",
      endQuestionNow: "End question now",
      nextQuestion: "Next question",
      finishGame: "Finish game",
      resumeGame: "Resume game",
      questionOfCtrl: "Question {position} of {total}",
      remaining: "remaining",
      closed: "Closed",
      answered: "answered",
      correctAnswer: "Correct answer",
      noActiveQuestion: "No active question.",
      questionDeck: "Question deck",
      active: "Active",
      done: "Done",
      upcoming: "Upcoming",
      results: "Results",
      place: "place",
      perQuestionBreakdown: "Per-question breakdown",
      noQuestionData: "No question data.",
      shareCode: "Share the code",
      studentsGoJoin:
        "Students go to {path} and enter this code to join the lobby.",
      playersHeading: "Players",
      waitingPlayers: "Waiting for players to join…",
      online: "online",
      away: "away",
      noScoresYet: "No scores yet.",
      dangerZone: "Danger zone",
      cancelGame: "Cancel game",
      deleteGame: "Delete game",
      cancelTitle: "Cancel this game?",
      cancelDesc:
        "The room closes and players can no longer answer. Results stay available.",
      keepPlaying: "Keep playing",
      deleteGameTitle: "Delete this game?",
      deleteGameDesc:
        "The game, its rounds and all player records are permanently removed.",
      keepIt: "Keep it",
      copied: "Copied!",
      classesTitle: "Classes",
      classesSub: "Group your students, share a code, and assign quizzes to a class.",
      createClass: "Create a class",
      createClassSub: "Share the code with your students.",
      className: "Class name",
      classNamePlaceholder: "e.g. Quran Group A",
      classDescription: "Description (optional)",
      classDescriptionPlaceholder: "e.g. Second period, beginners",
      createdToast: "Class created",
      createdToastDesc: "Share the code with your students.",
      createFailed: "Couldn't create the class",
      membersLabel: "Members",
      archiveLabel: "Archive",
      archivedToast: "Class archived",
      archivedToastDesc: "Students can no longer join it.",
      archiveTitle: "Archive this class?",
      archiveDesc: "will stop accepting new members. Existing assignments stay.",
      keepClass: "Keep class",
      archivedBadge: "Archived",
      noMembers: "No members yet",
      noMembersDesc: "Share the class code for students to join.",
      memberRemoved: "Member removed",
      removeMemberFailed: "Couldn't remove the member",
      noClassesYet: "No classes yet",
      noClassesYetDesc: "Create your first class and share its code with students.",
      copyFailedDesc: "Select the code manually.",
      membersLoadFailed: "Couldn't load members",
      createFailedDesc: "Check the name and try again.",
      memberWord: "members",
      gameWord: "games",
      copyClassCode: "Copy class code",
      membersJoinHint: "Students join from their classes page.",
      joinedOn: "Joined",
      removeMember: "Remove",
      copyFailed: "Couldn't copy",
      codeCopied: "Code copied",
      codeCopiedDesc: "Class code",
      analyticsTitle: "Analytics",
      analyticsSub: "Score, accuracy, response time and the questions your players missed.",
      manageGames: "Manage games",
      gamesLaunched: "Games launched",
      averageScore: "Average score",
      averageAccuracy: "Average accuracy",
      avgResponseTime: "Avg response time",
      mostMissed: "Most-missed questions",
      mostMissedSub: "Questions players got wrong most often in game",
      answersCount: "answers",
      noAnswers: "No answers yet",
      nothingMissed: "Nothing missed",
      nothingMissedDesc: "No wrong answers recorded for this game.",
      wrongAnswers: "wrong",
      correctPct: "% correct",
      questions: "Questions",
      answers: "Answers",
      gameBadgeFinished: "Finished",
      gameBadgeCancelled: "Cancelled",
      gameBadgeRunning: "Running",
      gameBadgeWaiting: "Waiting for players",
      gameBadgePaused: "Paused",
      loadAnalyticsFailed: "Couldn't load the analytics",
      loadGamesFailed: "Couldn't load your games",
      statQuestions: "Questions",
      statAnswers: "Answers",
      inGame: "In game {code}",
      pickAnotherGame: "Try again, or pick another game.",
    },
    editor: {
      settings: "Settings",
      quizName: "Quiz name",
      language: "Language",
      category: "Category",
      categoryPlaceholder: "e.g. Memorization",
      difficulty: "Difficulty",
      difficultyAny: "Any",
      difficultyEasy: "Easy",
      difficultyMedium: "Medium",
      difficultyHard: "Hard",
      defaultPoints: "Default points per question",
      defaultNegativePoints: "Default negative points (wrong answer)",
      classOptional: "Class (optional)",
      noClass: "No class",
      description: "Description (shown to players)",
      descriptionPlaceholder: "e.g. Surah Al-Baqarah, verses 1–10",
      speedBonus: "Grant a speed bonus for fast correct answers",
      questions: "Questions",
      addQuestion: "Add question",
      noDescription: "No description",
      editLabel: "Edit",
      openLabel: "Open",
      duplicateAction: "Duplicate",
      createQuiz: "Create a quiz",
      createSub: "You'll add questions right after — the quiz stays a draft until you launch it live.",
      quizNamePlaceholder: "e.g. Surah Al-Baqarah Basics",
      createAndAdd: "Create and add questions",
      quizCreated: "Quiz created",
      quizCreatedDesc: "Now add your questions.",
      createFailed: "Could not create the quiz.",
      quizNameRequired: "Give your quiz a name first.",
      saveChanges: "Save changes",
      savedToastTitle: "Quiz saved",
      savedToastDesc: "All changes are stored.",
      saveFailed: "Something went wrong while saving.",
      launchGame: "Launch live game",
      launchToastTitle: "Game launched",
      launchToastDesc: "The lobby is open — share the code.",
      launchFailed: "Try again.",
      launchDialogTitle: "Launch this quiz?",
      launchDialogDesc: "The room code is",
      launchDialogKeep: "Keep editing",
      launchDialogConfirm: "Launch game",
      deleteQuestion: "Delete question",
      preview: "Preview",
      backToLibrary: "Back to library",
      exitEditing: "Exit editing",
      exitConfirmTitle: "Leave the editor?",
      exitConfirmDesc: "Unsaved changes will be lost.",
      exitConfirmKeep: "Stay here",
      exitConfirmLeave: "Leave",
      typeLabel: "Type",
      typeMcq: "Multiple choice",
      typeTrueFalse: "True / False",
      typeText: "Short text",
      typeNumber: "Number",
      typeAudio: "Audio",
      questionText: "Question text",
      questionTextPlaceholder: "Type the question…",
      choices: "Choices",
      choiceLabel: "Choice",
      addChoice: "Add choice",
      correctAnswer: "Correct answer",
      markCorrect: "Mark as correct",
      duration: "Duration (seconds)",
      seconds: "s",
      pointsPerQuestion: "Points",
      default: "default",
      negativePoints: "Negative points",
      explanation: "Explanation (optional)",
      explanationPlaceholder: "Shown after the question closes…",
      surahRef: "Quran reference",
      surah: "Surah",
      ayah: "Ayah",
      page: "Page",
      juz: "Juz",
      hizb: "Hizb",
      missingText: "Question text is required.",
      missingChoices: "Each choice needs text.",
      missingTwoChoices: "Add at least two choices.",
      missingCorrectMarker: "Mark one choice as correct.",
      missingCorrectText: "Enter the correct answer text.",
      missingDuration: "Duration must be at least 5 seconds.",
      missingPoints: "Points can't be negative.",
      errorSummary: "Some questions are incomplete; fix them before saving.",
      notDraftLocked: "Editing is locked once the game is launched.",
      moveUp: "Move up",
      moveDown: "Move down",
      loadTitle: "Could not open this quiz",
      loadNotFound: "Quiz not found or you don't have access.",
      loadFailed: "Failed to load the quiz.",
      backToQuizzes: "Back to my quizzes",
      checkErrors: "Check the errors",
      checkErrorsDesc: "Some questions are incomplete; fix them before saving.",
      saveFailedTitle: "Save failed",
      launchFailedTitle: "Launch failed",
      untitledQuiz: "Untitled quiz",
      untitledQuestion: "Untitled question",
      unsaved: "Unsaved",
      discard: "Discard",
      addQuestionsFirst: "Add questions first",
      launched: "Launched",
      backToEditing: "Back to editing",
      incomplete: "Incomplete",
      launchDialogLocked: "Players can join as soon as the lobby opens — editing will be locked.",
      onlyOneCorrect: "Only one option can be the correct answer.",
      chooseCorrect: "Choose the correct answer.",
      optionsMark: "Options — mark the correct one",
      markOptionAria: "Mark option {n} as correct",
      removeOptionAria: "Remove option {n}",
      optionWord: "Option",
      addOption: "Add option",
      trueOption: "True",
      falseOption: "False",
      correctNumeric: "Correct numeric answer",
      correctTextHint: "Correct answer (exact text match, case-insensitive)",
      expected: "Expected",
    },
    game: {
      lobbyTitle: "Game lobby",
      lobbySub: "Get your device ready — the host will start the questions.",
      waitingForPlayers: "Waiting for players",
      startingSoon: "The game hasn't started yet.",
      gameEnded: "The game has ended.",
      leaveLobby: "Leave lobby",
      playerCount: "players joined",
      questionTitle: "Question",
      waitingForQuestion: "The host hasn't sent a question yet.",
      pausedOverlay: "Paused",
      pausedOverlayDesc: "The host paused the game — hang tight.",
      submitAnswer: "Submit answer",
      answerLocked: "Answer locked",
      skipped: "Skipped",
      correct: "Correct",
      wrong: "Wrong",
      feedback: "Feedback",
      youAnswered: "You answered:",
      correctAnswerIs: "Correct answer:",
      explanation: "Explanation",
      next: "Next",
      resultTitle: "Game results",
      yourScore: "Your score",
      yourRank: "Your rank",
      ofPlayers: "of",
      leaderboard: "Leaderboard",
      podium: "Podium",
      yourAnswers: "Your answers",
      timeUp: "Time's up!",
      answerNow: "Answer now",
      kbdChoice: "Press 1-4 to choose",
      networkError: "Connection lost — reconnecting…",
      retryJoin: "Reconnect",
      sessionExpired: "Your session expired. Please join again.",
      backToLobby: "Back to lobby",
      answeredCount: "answered",
      playersAnswered: "players answered",
      connecting: "Connecting to the game…",
      connectError: "Couldn't reach the game. Check your connection.",
      notAvailableTitle: "Game not available",
      notAvailableDesc: "This game was closed by the host or is no longer joinable.",
      you: "You",
      questionOf: "Question {position} of {total}",
      scoreLabel: "Score: {total}",
      pickAnswerError: "Pick an answer before submitting.",
      questionClosedError: "This question just closed. Wait for the host to continue.",
      sendAnswerFailed: "Couldn't send your answer",
      gettingReady: "Getting ready…",
      hostAboutToStart: "The host is about to start a question.",
      answerSubmitted: "Answer submitted",
      waitingTimer: "Waiting for the timer to finish…",
      wrongAnswer: "Wrong answer",
      noAnswerSubmitted: "No answer submitted",
      youPickedThis: "You picked this",
      why: "Why",
      revealingAnswer: "Revealing the answer…",
      loadingResults: "Loading results…",
      gameEndedTitle: "Game ended",
      leaveGame: "Leave the game",
      answerChoicesLabel: "Answer choices",
      typeNumber: "Type a number…",
      typeAnswer: "Type your answer…",
      gameStillRunning: "The game is still running",
      resultsAfterFinish: "Results appear once the host finishes the game.",
      backToGame: "Back to the game",
      gameFinishedTitle: "Game finished!",
      yourResultIntro: "{name}, here is your result.",
      returnHome: "Return home",
      firstPlace: "1st",
      secondPlace: "2nd",
      thirdPlace: "3rd",
    },
  },

  ar: {
    common: {
      save: "حفظ",
      saving: "جارٍ الحفظ…",
      cancel: "إلغاء",
      close: "إغلاق",
      delete: "حذف",
      archive: "أرشفة",
      create: "إنشاء",
      join: "انضمام",
      leave: "مغادرة",
      copy: "نسخ",
      retry: "إعادة المحاولة",
      back: "رجوع",
      tryAgain: "حاول مجددًا",
      confirm: "تأكيد",
      loading: "جارٍ التحميل…",
      code: "الرمز",
      players: "لاعبًا",
      points: "نقطة",
      finished: "منتهية",
      cancelled: "ملغاة",
      running: "جارية",
      waiting: "في انتظار",
      paused: "متوقفة مؤقتًا",
      noGamesYet: "لا توجد ألعاب بعد",
      noResults: "لا توجد نتائج",
      loadFailedTitle: "تعذّر تحميل هذه الصفحة",
      loadFailedDesc: "تحقق من اتصالك وحاول مجددًا.",
      draft: "مسودة",
      scheduled: "مجدول",
      reset: "إعادة ضبط",
      questionWord: "سؤالًا",
      answerWord: "إجابات",
      avg: "متوسط",
      errorTitle: "حدث خطأ ما",
      errorDesc: "حدث خطأ غير متوقع أثناء عرض هذا القسم.",
    },
    nav: {
      home: "الرئيسية",
      about: "عن المنصة",
      myQuizzes: "اختباراتي",
      liveGames: "الألعاب المباشرة",
      classes: "الصفوف",
      analytics: "التحليلات",
      newQuiz: "اختبار جديد",
      dashboard: "لوحة البيانات",
      history: "السجل",
      joinGame: "انضم إلى لعبة",
      logIn: "تسجيل الدخول",
      signOut: "تسجيل الخروج",
      host: "مضيف",
      toggle: "تبديل القائمة",
      main: "القائمة الرئيسية",
      mobile: "قائمة الجوال",
    },
    landing: {
      heroTitle: "مسابقات مباشرة مصممة للفصل الدراسي",
      heroSubtitle:
        "أطلق جولات أسئلة مباشرة مع طلابك، أو انضم إلى لعبة برمز. لا تنزيلات ولا إعداد — فقط أسئلة وإجابات ولوحة صدارة حية.",
      hostQuiz: "استضافة مسابقة",
      rolesHeading: "اختر تجربتك",
      hostTitle: "استضافة مسابقة",
      hostDescription:
        "أنشئ مسابقة، ابدأ لعبة مباشرة، وشاهد لوحة الصدارة تتحدث آنيًا.",
      startHosting: "ابدأ الاستضافة",
      joinTitle: "انضم إلى لعبة",
      joinDescription: "أدخل الرمز الذي شاركه معلمك، اختر اسمًا، والعب مباشرة على أي جهاز.",
      enterCode: "أدخل رمزًا",
      stepsHeading: "كيف تعمل",
      step1Title: "أنشئ أو افتح مسابقة",
      step1Description: "ابنِ أسئلتك، أو اختر مسابقة جاهزة من مكتبتك.",
      step2Title: "شارك رمز اللعبة",
      step2Description: "ينضم الطلاب إلى قاعة الانتظار بالرمز عبر هواتفهم.",
      step3Title: "العب في الوقت الفعلي",
      step3Description: "تظهر الأسئلة للجميع دفعة واحدة، وتُحدَّث النقاط مباشرة.",
    },
    about: {
      title: "عن المنصة",
      p1: "منصة مسابقات القرآن أداة تعليمية تفاعلية فورية. ينشئ المعلمون المسابقات ويستضيفون ألعابًا مباشرة برمز انضمام مشترك؛ ويجيب الطلاب على أجهزتهم بينما تتحدث النقاط ولوحة الصدارة فورًا.",
      p2: "تُجهَّز المنصة لمحتوى عربي أولًا، بما في ذلك أسئلة حفظ القرآن مع مراجع السورة والآية، ودعم كامل للاتجاه من اليمين إلى اليسار.",
      p3: "يعمل كل شيء عبر Supabase — المصادقة وقاعدة البيانات والتحديثات الفورية — فتبقى الأسئلة والإجابات وحالة اللعبة متزامنة دون بنية إضافية.",
    },
    auth: {
      welcomeBack: "مرحبًا بعودتك",
      logInSub: "سجّل الدخول لإدارة اختباراتك وألعابك.",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      createAccount: "إنشاء حساب",
      registerSub: "اختر دورك للبدء.",
      name: "الاسم الكامل",
      iAmHost: "أنا مضيف (معلم)",
      iAmStudent: "أنا طالب",
      alreadyHaveAccount: "لديك حساب بالفعل؟",
      noAccount: "ليس لديك حساب؟",
      forgotLink: "نسيت كلمة المرور؟",
      needAccount: "تحتاج حسابًا؟",
      signIn: "تسجيل الدخول",
      signUp: "إنشاء حساب",
      invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة. حاول مرة أخرى.",
      notConfigured: "Supabase غير مهيّأ على هذا النشر.",
      couldNotSignIn: "تعذّر تسجيل الدخول.",
      serverUnreachable: "تعذّر الوصول إلى الخادم. تحقق من اتصالك وحاول مجددًا.",
      accountCreatedTitle: "تم إنشاء الحساب",
      accountCreatedDesc: "جارٍ تسجيل دخولك…",
      nameTooShort: "يجب ألا يقل الاسم عن حرفين.",
      passwordTooShort: "يجب ألا تقل كلمة المرور عن 6 أحرف.",
      passwordsDoNotMatch: "كلمتا المرور غير متطابقتين.",
      accountType: "نوع الحساب",
      hostDescription: "أنشئ الاختبارات وشغّل الألعاب المباشرة",
      studentDescription: "انضم إلى الألعاب وتابع تقدّمك",
      confirmPassword: "تأكيد كلمة المرور",
      minCharsHint: "6 أحرف على الأقل.",
    },
    join: {
      title: "انضم إلى لعبة",
      subtitle: "أدخل رمز لعبة أو صف شاركه معلمك، ثم اختر اسمًا مستعارًا.",
      nickname: "اسمك المستعار",
      nicknamePlaceholder: "مثال: أحمد",
      gameCode: "الرمز",
      gameCodePlaceholder: "مثال: A1B2C3D4",
      joinButton: "انضم إلى اللعبة",
      nickError: "يجب أن يكون الاسم بين 2 و50 حرفًا.",
      codeError: "أدخل رمز اللعبة الذي يعرضه المضيف.",
      notOpenError: "هذه اللعبة غير مفتوحة للانضمام بعد. تحقق من الرمز مع المضيف.",
      draftError:
        "لم يُطلق هذا الاختبار بعد. اطلب من المضيف إطلاقه من مكتبة الاختبارات — لا يمكن الانضمام إلى المسودات.",
      classCodeError:
        "هذا رمز صف، وليس رمز لعبة. انضم إلى الصف من صفحة صفوفك — الألعاب المباشرة تستخدم الرمز الظاهر في غرفة تحكم المضيف.",
      classCodeNeedsLogin:
        "أكواد الصفوف تتطلب تسجيل الدخول. سجّل الدخول ثم انضم إلى الصف من صفحة صفوفك.",
      genericErrorTitle: "تعذّر الانضمام إلى اللعبة",
      genericErrorDesc: "تحقق من اتصالك وحاول مجددًا.",
    },
    student: {
      progress: "تقدّمي",
      progressSub: "سجل ألعابك مرتبط بحسابك — سجّل الدخول قبل الانضمام لتتبعه.",
      gamesPlayed: "الألعاب التي لعبتها",
      joined: "انضممت",
      avgScore: "متوسط النقاط",
      avgAccuracy: "متوسط الدقة",
      bestScore: "أفضل نتيجة",
      recentGames: "الألعاب الأخيرة",
      noGamesTitle: "لا توجد ألعاب بعد",
      noGamesDesc: "انضم إلى لعبة مباشرة بالرمز الذي يعرضه مضيفك — ستظهر النتائج هنا.",
      historyTitle: "سجل الألعاب",
      historySub: "كل لعبة انضممت إليها أثناء تسجيل الدخول، مع نتيجتك ودقتك.",
      correctOf: "إجابات صحيحة",
      pts: "نقطة",
      myClasses: "صفوفي",
      myClassesSub: "انضم بالرمز الذي يشاركه معلمك لتبقى ضمن مجموعته.",
      joinClass: "الانضمام إلى صف",
      joinClassSub: "أدخل رمز الصف الذي شاركه معلمك.",
      classCode: "رمز الصف",
      classCodePlaceholder: "مثال: SBJ2S9YY",
      joinClassButton: "انضم إلى الصف",
      classCodeError: "أدخل رمز الصف الذي شاركه معلمك.",
      classNotOpen: "رمز الصف هذا غير مفتوح الآن. تحقق مع معلمك.",
      classJoined: "تم الانضمام إلى الصف",
      classLeft: "غادرت الصف",
      noClassesTitle: "لا توجد صفوف بعد",
      noClassesDesc: "اسأل معلمك عن رمز الصف وأدخله أعلاه.",
      members: "عضوًا",
      signInToTrack: "سجّل الدخول لتتبع تقدّمك",
      classJoinedDesc: "يمكنك الآن رؤية صفك هنا.",
      classJoinFailed: "تعذّر الانضمام إلى الصف",
      classLeftDesc: "أُزيل {name} من قائمتك.",
      classLeaveFailed: "تعذّر مغادرة الصف",
      classesLoadFailed: "تعذّر تحميل صفوفك",
    },
    host: {
      myGamesTitle: "الألعاب المباشرة",
      myGamesSub: "الألعاب التي أطلقتها. افتح غرفة التحكم لإدارة جولة.",
      browseQuizzes: "تصفح الاختبارات",
      cancel: "إلغاء",
      cancelledToastTitle: "أُلغيَت اللعبة",
      cancelledToastDesc: "تم إيقاف",
      cancelFailed: "تعذّر الإلغاء",
      loadFailedTitle: "تعذّر تحميل ألعابك",
      loadFailedDesc: "تحقق من اتصالك وحاول مجددًا.",
      openControlRoom: "فتح غرفة التحكم",
      noGamesTitle: "لا توجد ألعاب بعد",
      noGamesDesc:
        "اختر اختبارًا من مكتبتك وأطلقه — ينضم الطلاب عبر رمز الغرفة.",
      librarySub: "ابنِ اختباراتك ونظّمها، ثم أطلقها كألعاب مباشرة.",
      searchPlaceholder: "ابحث بالاسم أو الرمز أو التصنيف…",
      searchLabel: "البحث في الاختبارات",
      of: "من",
      noQuizzesYet: "لا توجد اختبارات بعد",
      noQuizzesDesc:
        "أنشئ اختبارك الأول — الأسئلة والنقاط ومراجع القرآن كلها قابلة للتحرير.",
      noMatches: "لا نتائج مطابقة",
      noMatchesDesc: "جرّب كلمة بحث مختلفة.",
      createQuiz: "إنشاء اختبار",
      duplicatedTitle: "تم تكرار الاختبار",
      duplicatedDesc: "افتح النسخة لتحريرها.",
      duplicateFailed: "فشل التكرار",
      deletedTitle: "تم حذف الاختبار",
      deletedDesc: "أُزيل «{name}».",
      deleteFailed: "فشل الحذف",
      archivedTitle: "تمت الأرشفة",
      archivedDesc: "نُقل خارج المكتبة النشطة.",
      archiveFailed: "فشلت الأرشفة",
      deleteTitle: "حذف هذا الاختبار؟",
      deleteDesc: "سيُحذف «{name}» نهائيًا مع أسئلته البالغة {count} سؤالًا.",
      deletePermanently: "حذف نهائي",
      lobbyOpen: "القاعة مفتوحة",
      setupTitle: "إعداد اللعبة",
      setupTagline:
        "حدّد عنوان اللعبة الذي يراه الطلاب، والتعليمات الاختيارية، والمدة المتاحة لكل سؤال.",
      setupGameTitle: "عنوان اللعبة",
      setupGameTitlePlaceholder: "مثال: جولة الليل القرآنية 2",
      setupInstructions: "التعليمات (اختياري)",
      setupInstructionsPlaceholder: "تُعرض للطلاب أثناء انتظارهم في القاعة…",
      setupMinutesPerQuestion: "الوقت لكل سؤال (دقائق)",
      setupMinutesHint: "تُقصّ الأسئلة الأطول من هذا الحد إلى الحد نفسه عند بدء السؤال.",
      setupSave: "حفظ الإعداد",
      setupSaved: "تم حفظ الإعداد",
      setupSaveFailed: "تعذّر حفظ الإعداد",
      gameNotFound: "اللعبة غير موجودة. تحقق من رمز الغرفة.",
      couldNotOpen: "تعذّر فتح هذه اللعبة.",
      backToGames: "العودة إلى الألعاب",
      couldNotCopy: "تعذّر نسخ الرمز.",
      actionFailed: "فشل الإجراء",
      gameDeleted: "تم حذف اللعبة",
      gameDeletedDesc: "أُزيلت جميع الجولات واللاعبين.",
      pause: "إيقاف مؤقت",
      startGame: "بدء اللعبة",
      endQuestionNow: "إنهاء السؤال الآن",
      nextQuestion: "السؤال التالي",
      finishGame: "إنهاء اللعبة",
      resumeGame: "استئناف اللعبة",
      questionOfCtrl: "السؤال {position} من {total}",
      remaining: "متبقٍ",
      closed: "مغلق",
      answered: "أجابوا",
      correctAnswer: "الإجابة الصحيحة",
      noActiveQuestion: "لا يوجد سؤال نشط.",
      questionDeck: "قائمة الأسئلة",
      active: "نشط",
      done: "منتهٍ",
      upcoming: "قادم",
      results: "النتائج",
      place: "المركز",
      perQuestionBreakdown: "تفصيل كل سؤال",
      noQuestionData: "لا توجد بيانات عن الأسئلة.",
      shareCode: "شارك الرمز",
      studentsGoJoin: "يذهب الطلاب إلى {path} ويدخلون هذا الرمز للانضمام إلى القاعة.",
      playersHeading: "اللاعبون",
      waitingPlayers: "بانتظار انضمام اللاعبين…",
      online: "متصل",
      away: "غير متصل",
      noScoresYet: "لا توجد نقاط بعد.",
      dangerZone: "منطقة الخطر",
      cancelGame: "إلغاء اللعبة",
      deleteGame: "حذف اللعبة",
      cancelTitle: "إلغاء هذه اللعبة؟",
      cancelDesc: "تُغلق الغرفة ولن يتمكن اللاعبون من الإجابة. تبقى النتائج متاحة.",
      keepPlaying: "مواصلة اللعب",
      deleteGameTitle: "حذف هذه اللعبة؟",
      deleteGameDesc: "سيُحذف نهائيًا اللعبة وجولاتها وكل سجلات اللاعبين.",
      keepIt: "الإبقاء عليها",
      copied: "تم النسخ!",
      classesTitle: "الصفوف",
      classesSub: "جمّع طلابك، شارك رمزًا، واربط الاختبارات بصف.",
      createClass: "إنشاء صف",
      createClassSub: "شارك الرمز مع طلابك.",
      className: "اسم الصف",
      classNamePlaceholder: "مثال: مجموعة القرآن أ",
      classDescription: "الوصف (اختياري)",
      classDescriptionPlaceholder: "مثال: الحصة الثانية، مبتدئون",
      createdToast: "تم إنشاء الصف",
      createdToastDesc: "شارك الرمز مع طلابك.",
      createFailed: "تعذّر إنشاء الصف",
      membersLabel: "الأعضاء",
      archiveLabel: "أرشفة",
      archivedToast: "تمت أرشفة الصف",
      archivedToastDesc: "لا يمكن للطلاب الانضمام إليه بعد الآن.",
      archiveTitle: "أرشفة هذا الصف؟",
      archiveDesc: "لن يقبل أعضاءً جددًا. التعيينات القائمة تبقى.",
      keepClass: "إبقاء الصف",
      archivedBadge: "مؤرشَف",
      noMembers: "لا أعضاء بعد",
      noMembersDesc: "شارك رمز الصف ليلتحق الطلاب.",
      memberRemoved: "تمت إزالة العضو",
      removeMemberFailed: "تعذّرت إزالة العضو",
      noClassesYet: "لا توجد صفوف بعد",
      copyFailedDesc: "حدّد الرمز يدويًا.",
      membersLoadFailed: "تعذّر تحميل الأعضاء",
      createFailedDesc: "تحقق من الاسم وحاول مجددًا.",
      memberWord: "أعضاء",
      gameWord: "ألعاب",
      copyClassCode: "نسخ رمز الصف",
      membersJoinHint: "ينضم الطلاب من صفحة الصفوف لديهم.",
      joinedOn: "انضم",
      removeMember: "إزالة",
      noClassesYetDesc: "أنشئ صفك الأول وشارك رمزه مع الطلاب.",
      copyFailed: "تعذّر النسخ",
      codeCopied: "تم نسخ الرمز",
      codeCopiedDesc: "رمز الصف",
      analyticsTitle: "التحليلات",
      analyticsSub: "النقاط والدقة وزمن الاستجابة والأسئلة التي أخطأ فيها لاعبوك.",
      manageGames: "إدارة الألعاب",
      gamesLaunched: "الألعاب المطلقة",
      averageScore: "متوسط النتيجة",
      averageAccuracy: "متوسط الدقة",
      avgResponseTime: "متوسط زمن الاستجابة",
      mostMissed: "الأسئلة الأكثر إجابة خاطئة",
      mostMissedSub: "الأسئلة التي أخطأ فيها اللاعبون في لعبة",
      answersCount: "إجابة",
      noAnswers: "لا إجابات بعد",
      nothingMissed: "لم يُخطئ أحد",
      nothingMissedDesc: "لا توجد إجابات خاطئة مسجلة لهذه اللعبة.",
      wrongAnswers: "إجابة خاطئة",
      correctPct: "% صحيحة",
      questions: "أسئلة",
      answers: "إجابات",
      gameBadgeFinished: "منتهية",
      gameBadgeCancelled: "ملغاة",
      gameBadgeRunning: "جارية",
      gameBadgeWaiting: "بانتظار اللاعبين",
      gameBadgePaused: "متوقفة مؤقتًا",
      loadAnalyticsFailed: "تعذّر تحميل التحليلات",
      loadGamesFailed: "تعذّر تحميل ألعابك",
      statQuestions: "أسئلة",
      statAnswers: "إجابات",
      inGame: "في لعبة {code}",
      pickAnotherGame: "حاول مجددًا، أو اختر لعبة أخرى.",
    },
    editor: {
      settings: "الإعدادات",
      quizName: "اسم الاختبار",
      language: "اللغة",
      category: "التصنيف",
      categoryPlaceholder: "مثال: حفظ",
      difficulty: "الصعوبة",
      difficultyAny: "أي",
      difficultyEasy: "سهل",
      difficultyMedium: "متوسط",
      difficultyHard: "صعب",
      defaultPoints: "النقاط الافتراضية للسؤال",
      defaultNegativePoints: "النقاط السالبة الافتراضية (إجابة خاطئة)",
      classOptional: "الصف (اختياري)",
      noClass: "بدون صف",
      description: "الوصف (يظهر للاعبين)",
      descriptionPlaceholder: "مثال: سورة البقرة، الآيات 1–10",
      speedBonus: "منح مكافأة سرعة للإجابات الصحيحة السريعة",
      questions: "الأسئلة",
      addQuestion: "إضافة سؤال",
      noDescription: "لا يوجد وصف",
      editLabel: "تحرير",
      openLabel: "فتح",
      duplicateAction: "تكرار",
      createQuiz: "إنشاء اختبار",
      createSub: "ستضيف الأسئلة بعد ذلك مباشرة — يبقى الاختبار مسودة حتى تطلقه مباشرًا.",
      quizNamePlaceholder: "مثال: أساسيات سورة البقرة",
      createAndAdd: "إنشاء وإضافة الأسئلة",
      quizCreated: "تم إنشاء الاختبار",
      quizCreatedDesc: "أضف أسئلتك الآن.",
      createFailed: "تعذّر إنشاء الاختبار.",
      quizNameRequired: "أعطِ اختبارك اسمًا أولًا.",
      saveChanges: "حفظ التغييرات",
      savedToastTitle: "تم حفظ الاختبار",
      savedToastDesc: "خُزِّنت جميع التغييرات.",
      saveFailed: "حدث خطأ أثناء الحفظ.",
      launchGame: "إطلاق لعبة مباشرة",
      launchToastTitle: "أُطلقت اللعبة",
      launchToastDesc: "قاعة الانتظار مفتوحة — شارك الرمز.",
      launchFailed: "حاول مجددًا.",
      launchDialogTitle: "إطلاق هذا الاختبار؟",
      launchDialogDesc: "رمز القاعة هو",
      launchDialogKeep: "مواصلة التحرير",
      launchDialogConfirm: "إطلاق اللعبة",
      deleteQuestion: "حذف السؤال",
      preview: "معاينة",
      backToLibrary: "العودة إلى المكتبة",
      exitEditing: "الخروج من التحرير",
      exitConfirmTitle: "مغادرة المحرر؟",
      exitConfirmDesc: "ستُفقد التغييرات غير المحفوظة.",
      exitConfirmKeep: "البقاء هنا",
      exitConfirmLeave: "مغادرة",
      typeLabel: "النوع",
      typeMcq: "اختيار من متعدد",
      typeTrueFalse: "صواب / خطأ",
      typeText: "نص قصير",
      typeNumber: "رقم",
      typeAudio: "صوتي",
      questionText: "نص السؤال",
      questionTextPlaceholder: "اكتب السؤال…",
      choices: "الخيارات",
      choiceLabel: "خيار",
      addChoice: "إضافة خيار",
      correctAnswer: "الإجابة الصحيحة",
      markCorrect: "تحديد كصحيح",
      duration: "المدة (بالثواني)",
      seconds: "ث",
      pointsPerQuestion: "النقاط",
      default: "الافتراضي",
      negativePoints: "النقاط السالبة",
      explanation: "التفسير (اختياري)",
      explanationPlaceholder: "يظهر بعد انتهاء السؤال…",
      surahRef: "مرجع قرآني",
      surah: "السورة",
      ayah: "الآية",
      page: "الصفحة",
      juz: "الجزء",
      hizb: "الحزب",
      missingText: "نص السؤال مطلوب.",
      missingChoices: "كل خيار يحتاج نصًا.",
      missingTwoChoices: "أضف خيارين على الأقل.",
      missingCorrectMarker: "حدد خيارًا واحدًا كصحيح.",
      missingCorrectText: "أدخل نص الإجابة الصحيحة.",
      missingDuration: "يجب أن تكون المدة 5 ثوانٍ على الأقل.",
      missingPoints: "لا يمكن أن تكون النقاط سالبة.",
      errorSummary: "بعض الأسئلة غير مكتملة؛ صحّحها قبل الحفظ.",
      notDraftLocked: "التحرير مقفل بعد إطلاق اللعبة.",
      moveUp: "تحريك لأعلى",
      moveDown: "تحريك لأسفل",
      loadTitle: "تعذّر فتح هذا الاختبار",
      loadNotFound: "الاختبار غير موجود أو ليس لديك صلاحية الوصول.",
      loadFailed: "تعذّر تحميل الاختبار.",
      backToQuizzes: "العودة إلى اختباراتي",
      checkErrors: "تحقق من الأخطاء",
      checkErrorsDesc: "بعض الأسئلة غير مكتملة؛ أصلحها قبل الحفظ.",
      saveFailedTitle: "فشل الحفظ",
      launchFailedTitle: "فشل الإطلاق",
      untitledQuiz: "اختبار بدون عنوان",
      untitledQuestion: "سؤال بدون عنوان",
      unsaved: "غير محفوظ",
      discard: "تجاهل",
      addQuestionsFirst: "أضف الأسئلة أولًا",
      launched: "تم إطلاقه",
      backToEditing: "العودة للتحرير",
      incomplete: "غير مكتمل",
      launchDialogLocked: "يمكن للاعبين الانضمام فور فتح الصالة — سيتم قفل التحرير.",
      onlyOneCorrect: "إجابة واحدة فقط يمكن أن تكون الصحيحة.",
      chooseCorrect: "اختر الإجابة الصحيحة.",
      optionsMark: "الخيارات — علّم الصحيح",
      markOptionAria: "تحديد الخيار {n} كإجابة صحيحة",
      removeOptionAria: "إزالة الخيار {n}",
      optionWord: "خيار",
      addOption: "إضافة خيار",
      trueOption: "صحيح",
      falseOption: "خطأ",
      correctNumeric: "الإجابة الرقمية الصحيحة",
      correctTextHint: "الإجابة الصحيحة (مطابقة نصية دقيقة مع تجاهل حالة الأحرف)",
      expected: "المتوقعة",
    },
    game: {
      lobbyTitle: "قاعة الانتظار",
      lobbySub: "جهّز جهازك — سيبدأ المضيف الأسئلة قريبًا.",
      waitingForPlayers: "بانتظار اللاعبين",
      startingSoon: "لم تبدأ اللعبة بعد.",
      gameEnded: "انتهت اللعبة.",
      leaveLobby: "مغادرة القاعة",
      playerCount: "لاعبًا انضموا",
      questionTitle: "سؤال",
      waitingForQuestion: "لم يرسل المضيف سؤالًا بعد.",
      pausedOverlay: "متوقفة مؤقتًا",
      pausedOverlayDesc: "أوقف المضيف اللعبة — انتظر قليلًا.",
      submitAnswer: "إرسال الإجابة",
      answerLocked: "الإجابة مقفلة",
      skipped: "تخطّيت",
      correct: "صحيحة",
      wrong: "خاطئة",
      feedback: "النتيجة",
      youAnswered: "أجبت بـ:",
      correctAnswerIs: "الإجابة الصحيحة:",
      explanation: "التفسير",
      next: "التالي",
      resultTitle: "نتائج اللعبة",
      yourScore: "نتيجتك",
      yourRank: "ترتيبك",
      ofPlayers: "من",
      leaderboard: "لوحة الصدارة",
      podium: "المنصة",
      yourAnswers: "إجاباتك",
      timeUp: "انتهى الوقت!",
      answerNow: "أجب الآن",
      kbdChoice: "اضغط 1–4 للاختيار",
      networkError: "انقطع الاتصال — إعادة الاتصال…",
      retryJoin: "إعادة الاتصال",
      sessionExpired: "انتهت جلستك. يرجى الانضمام مجددًا.",
      backToLobby: "العودة إلى القاعة",
      answeredCount: "أجاب",
      playersAnswered: "لاعب أجابوا",
      connecting: "جارٍ الاتصال باللعبة…",
      connectError: "تعذّر الوصول إلى اللعبة. تحقق من اتصالك.",
      notAvailableTitle: "اللعبة غير متاحة",
      notAvailableDesc: "أغلق المضيف هذه اللعبة أو لم تعد قابلة للانضمام.",
      you: "أنت",
      questionOf: "السؤال {position} من {total}",
      scoreLabel: "النقاط: {total}",
      pickAnswerError: "اختر إجابة قبل الإرسال.",
      questionClosedError: "أُغلق هذا السؤال للتو. انتظر حتى يواصل المضيف.",
      sendAnswerFailed: "تعذّر إرسال إجابتك",
      gettingReady: "جارٍ التحضير…",
      hostAboutToStart: "المضيف على وشك بدء سؤال.",
      answerSubmitted: "تم إرسال الإجابة",
      waitingTimer: "بانتظار انتهاء المؤقت…",
      wrongAnswer: "إجابة خاطئة",
      noAnswerSubmitted: "لم تُرسل إجابة",
      youPickedThis: "اخترت هذا",
      why: "السبب",
      revealingAnswer: "جارٍ كشف الإجابة…",
      loadingResults: "جارٍ تحميل النتائج…",
      gameEndedTitle: "انتهت اللعبة",
      leaveGame: "مغادرة اللعبة",
      answerChoicesLabel: "خيارات الإجابة",
      typeNumber: "اكتب رقمًا…",
      typeAnswer: "اكتب إجابتك…",
      gameStillRunning: "اللعبة ما زالت جارية",
      resultsAfterFinish: "تظهر النتائج بمجرد إنهاء المضيف للعبة.",
      backToGame: "العودة إلى اللعبة",
      gameFinishedTitle: "انتهت اللعبة!",
      yourResultIntro: "{name}، هذه نتيجتك.",
      returnHome: "العودة إلى الرئيسية",
      firstPlace: "الأول",
      secondPlace: "الثاني",
      thirdPlace: "الثالث",
    },
  },

  fr: {
    common: {
      save: "Enregistrer",
      saving: "Enregistrement…",
      cancel: "Annuler",
      close: "Fermer",
      delete: "Supprimer",
      archive: "Archiver",
      create: "Créer",
      join: "Rejoindre",
      leave: "Quitter",
      copy: "Copier",
      retry: "Réessayer",
      back: "Retour",
      tryAgain: "Réessayer",
      confirm: "Confirmer",
      loading: "Chargement…",
      code: "Code",
      players: "joueurs",
      points: "pts",
      finished: "Terminé",
      cancelled: "Annulé",
      running: "En cours",
      waiting: "En attente",
      paused: "En pause",
      noGamesYet: "Aucun jeu pour l'instant",
      noResults: "Aucun résultat",
      loadFailedTitle: "Impossible de charger cette page",
      loadFailedDesc: "Vérifiez votre connexion et réessayez.",
      draft: "Brouillon",
      scheduled: "Programmé",
      reset: "Réinitialiser",
      questionWord: "questions",
      answerWord: "réponses",
      avg: "moy.",
      errorTitle: "Quelque chose s'est mal passé",
      errorDesc: "Une erreur inattendue s'est produite lors du rendu de cette section.",
    },
    nav: {
      home: "Accueil",
      about: "À propos",
      myQuizzes: "Mes quiz",
      liveGames: "Jeux en direct",
      classes: "Classes",
      analytics: "Analytics",
      newQuiz: "Nouveau quiz",
      dashboard: "Tableau de bord",
      history: "Historique",
      joinGame: "Rejoindre un jeu",
      logIn: "Connexion",
      signOut: "Se déconnecter",
      host: "Hôte",
      toggle: "Basculer la navigation",
      main: "Navigation principale",
      mobile: "Navigation mobile",
    },
    landing: {
      heroTitle: "Quiz en direct, pensés pour la classe",
      heroSubtitle:
        "Animez des tours de questions en temps réel avec vos élèves, ou rejoignez un jeu avec un code. Rien à télécharger — des questions, des réponses et un classement en direct.",
      hostQuiz: "Héberger un quiz",
      rolesHeading: "Choisissez votre expérience",
      hostTitle: "Héberger un quiz",
      hostDescription:
        "Créez un quiz, lancez un jeu en direct et regardez le classement se mettre à jour en temps réel.",
      startHosting: "Commencer",
      joinTitle: "Rejoindre un jeu",
      joinDescription:
        "Entrez le code partagé par votre enseignant, choisissez un pseudo et jouez en direct sur n'importe quel appareil.",
      enterCode: "Entrer un code",
      stepsHeading: "Comment ça marche",
      step1Title: "Créez ou ouvrez un quiz",
      step1Description: "Construisez vos questions ou choisissez un quiz existant.",
      step2Title: "Partagez le code du jeu",
      step2Description: "Les élèves rejoignent la salle avec le code sur leur téléphone.",
      step3Title: "Jouez en temps réel",
      step3Description: "Les questions apparaissent pour tous en même temps. Scores en direct.",
    },
    about: {
      title: "À propos de la plateforme",
      p1: "Quran Quiz Platform est un outil de quiz éducatif en temps réel. Les enseignants créent des quiz et animent des jeux en direct avec un code commun ; les élèves répondent sur leurs appareils pendant que les scores et le classement se mettent à jour instantanément.",
      p2: "La plateforme se prépare pour un contenu majoritairement en arabe, notamment des questions de mémorisation du Coran avec références à la sourate et au verset, avec une prise en charge complète du sens droit-à-gauche.",
      p3: "Tout fonctionne sur Supabase — authentification, base de données et mises à jour en temps réel — pour garder questions, réponses et état du jeu synchronisés sans infrastructure supplémentaire.",
    },
    auth: {
      welcomeBack: "Bon retour",
      logInSub: "Connectez-vous pour gérer vos quiz et jeux.",
      email: "E-mail",
      password: "Mot de passe",
      createAccount: "Créer un compte",
      registerSub: "Choisissez un rôle pour commencer.",
      name: "Nom complet",
      iAmHost: "Je suis un hôte (enseignant)",
      iAmStudent: "Je suis un élève",
      alreadyHaveAccount: "Déjà un compte ?",
      noAccount: "Pas encore de compte ?",
      forgotLink: "Mot de passe oublié ?",
      needAccount: "Besoin d'un compte ?",
      signIn: "Se connecter",
      signUp: "Créer un compte",
      invalidCredentials: "E-mail ou mot de passe invalide. Veuillez réessayer.",
      notConfigured: "Supabase n'est pas configuré sur ce déploiement.",
      couldNotSignIn: "Connexion impossible.",
      serverUnreachable: "Serveur injoignable. Vérifiez votre connexion et réessayez.",
      accountCreatedTitle: "Compte créé",
      accountCreatedDesc: "Connexion en cours…",
      nameTooShort: "Le nom doit contenir au moins 2 caractères.",
      passwordTooShort: "Le mot de passe doit contenir au moins 6 caractères.",
      passwordsDoNotMatch: "Les mots de passe ne correspondent pas.",
      accountType: "Type de compte",
      hostDescription: "Créez des quiz et lancez des jeux en direct",
      studentDescription: "Rejoignez des jeux et suivez votre progression",
      confirmPassword: "Confirmer le mot de passe",
      minCharsHint: "Au moins 6 caractères.",
    },
    join: {
      title: "Rejoindre un jeu",
      subtitle: "Saisissez un code de jeu ou de classe partagé par votre enseignant, puis choisissez un pseudo.",
      nickname: "Votre pseudo",
      nicknamePlaceholder: "ex. Ahmed",
      gameCode: "Code",
      gameCodePlaceholder: "ex. A1B2C3D4",
      joinButton: "Rejoindre le jeu",
      nickError: "Le pseudo doit faire entre 2 et 50 caractères.",
      codeError: "Entrez le code du jeu affiché par l'hôte.",
      notOpenError: "Ce jeu n'accepte pas encore de joueurs. Vérifiez le code avec l'hôte.",
      draftError:
        "Ce quiz n'a pas encore été lancé. Demandez à l'hôte de le lancer depuis sa bibliothèque — les brouillons ne sont pas joignables.",
      classCodeError:
        "Ce code est un code de classe, pas un code de jeu. Rejoignez la classe depuis votre page Classes — les jeux en direct utilisent le code affiché dans la salle de contrôle de l'hôte.",
      classCodeNeedsLogin:
        "Les codes de classe nécessitent un compte connecté. Connectez-vous, puis rejoignez la classe depuis votre page Classes.",
      genericErrorTitle: "Impossible de rejoindre le jeu",
      genericErrorDesc: "Vérifiez votre connexion et réessayez.",
    },
    student: {
      progress: "Ma progression",
      progressSub:
        "Votre historique de jeux suit votre compte — connectez-vous avant de rejoindre pour le suivre.",
      gamesPlayed: "Jeux joués",
      joined: "rejoint",
      avgScore: "Score moyen",
      avgAccuracy: "Précision moyenne",
      bestScore: "Meilleur score",
      recentGames: "Jeux récents",
      noGamesTitle: "Aucun jeu pour l'instant",
      noGamesDesc:
        "Rejoignez un jeu en direct avec le code affiché par votre hôte — les résultats apparaîtront ici.",
      historyTitle: "Historique des jeux",
      historySub: "Chaque jeu rejoint en étant connecté, avec votre score et votre précision.",
      correctOf: "corrects",
      pts: "pts",
      myClasses: "Mes classes",
      myClassesSub: "Rejoignez avec le code partagé par votre enseignant.",
      joinClass: "Rejoindre une classe",
      joinClassSub: "Entrez le code de classe partagé par votre enseignant.",
      classCode: "Code de classe",
      classCodePlaceholder: "ex. SBJ2S9YY",
      joinClassButton: "Rejoindre la classe",
      classCodeError: "Entrez le code de classe partagé par votre enseignant.",
      classNotOpen: "Ce code de classe n'est pas actif. Vérifiez avec votre enseignant.",
      classJoined: "Classe rejointe",
      classLeft: "Classe quittée",
      noClassesTitle: "Aucune classe pour l'instant",
      noClassesDesc: "Demandez le code à votre enseignant et saisissez-le ci-dessus.",
      members: "membres",
      signInToTrack: "Connectez-vous pour suivre votre progression",
      classJoinedDesc: "Vous pouvez maintenant voir votre classe ici.",
      classJoinFailed: "Impossible de rejoindre la classe",
      classLeftDesc: "{name} a été retirée de votre liste.",
      classLeaveFailed: "Impossible de quitter la classe",
      classesLoadFailed: "Impossible de charger vos classes",
    },
    host: {
      myGamesTitle: "Jeux en direct",
      myGamesSub: "Les jeux que vous avez lancés. Ouvrez une salle de contrôle pour une manche.",
      browseQuizzes: "Parcourir les quiz",
      cancel: "Annuler",
      cancelledToastTitle: "Jeu annulé",
      cancelledToastDesc: "a été arrêté.",
      cancelFailed: "Annulation impossible",
      loadFailedTitle: "Impossible de charger vos jeux",
      loadFailedDesc: "Vérifiez votre connexion et réessayez.",
      openControlRoom: "Salle de contrôle",
      noGamesTitle: "Aucun jeu pour l'instant",
      noGamesDesc:
        "Choisissez un quiz de votre bibliothèque et lancez-le — les élèves rejoignent avec le code de la salle.",
      librarySub: "Créez et organisez des quiz, puis lancez-les comme jeux en direct.",
      searchPlaceholder: "Rechercher par nom, code ou catégorie…",
      searchLabel: "Rechercher des quiz",
      of: "sur",
      noQuizzesYet: "Aucun quiz pour l'instant",
      noQuizzesDesc:
        "Créez votre premier quiz — questions, scores et références coraniques sont modifiables.",
      noMatches: "Aucun résultat",
      noMatchesDesc: "Essayez un autre terme de recherche.",
      createQuiz: "Créer un quiz",
      duplicatedTitle: "Quiz dupliqué",
      duplicatedDesc: "Ouvrez la copie pour la modifier.",
      duplicateFailed: "Échec de la duplication",
      deletedTitle: "Quiz supprimé",
      deletedDesc: "« {name} » a été supprimé.",
      deleteFailed: "Échec de la suppression",
      archivedTitle: "Quiz archivé",
      archivedDesc: "Retiré de la bibliothèque active.",
      archiveFailed: "Échec de l'archivage",
      deleteTitle: "Supprimer ce quiz ?",
      deleteDesc: "« {name} » et ses {count} question(s) seront définitivement supprimés.",
      deletePermanently: "Supprimer définitivement",
      lobbyOpen: "Salle ouverte",
      setupTitle: "Configuration du jeu",
      setupTagline:
        "Définissez le titre du jeu vu par les élèves, les consignes facultatives et le temps accordé à chaque question.",
      setupGameTitle: "Titre du jeu",
      setupGameTitlePlaceholder: "ex. Manche coranique du soir n°2",
      setupInstructions: "Consignes (facultatif)",
      setupInstructionsPlaceholder: "Affichées aux élèves pendant l'attente dans le lobby…",
      setupMinutesPerQuestion: "Temps par question (minutes)",
      setupMinutesHint: "Les questions plus longues que cette limite sont réduites à cette durée au démarrage.",
      setupSave: "Enregistrer",
      setupSaved: "Configuration enregistrée",
      setupSaveFailed: "Enregistrement impossible",
      gameNotFound: "Jeu introuvable. Vérifiez le code de la salle.",
      couldNotOpen: "Impossible d'ouvrir ce jeu.",
      backToGames: "Retour aux jeux",
      couldNotCopy: "Impossible de copier le code.",
      actionFailed: "Échec de l'action",
      gameDeleted: "Jeu supprimé",
      gameDeletedDesc: "Toutes les manches et joueurs ont été supprimés.",
      pause: "Pause",
      startGame: "Lancer le jeu",
      endQuestionNow: "Terminer la question",
      nextQuestion: "Question suivante",
      finishGame: "Terminer le jeu",
      resumeGame: "Reprendre le jeu",
      questionOfCtrl: "Question {position} sur {total}",
      remaining: "restant",
      closed: "Fermée",
      answered: "ont répondu",
      correctAnswer: "Bonne réponse",
      noActiveQuestion: "Aucune question active.",
      questionDeck: "Liste des questions",
      active: "Active",
      done: "Terminée",
      upcoming: "À venir",
      results: "Résultats",
      place: "place",
      perQuestionBreakdown: "Détail par question",
      noQuestionData: "Aucune donnée sur les questions.",
      shareCode: "Partager le code",
      studentsGoJoin:
        "Les élèves vont sur {path} et saisissent ce code pour rejoindre la salle.",
      playersHeading: "Joueurs",
      waitingPlayers: "En attente de joueurs…",
      online: "en ligne",
      away: "absent",
      noScoresYet: "Pas encore de scores.",
      dangerZone: "Zone de danger",
      cancelGame: "Annuler le jeu",
      deleteGame: "Supprimer le jeu",
      cancelTitle: "Annuler ce jeu ?",
      cancelDesc:
        "La salle se ferme et les joueurs ne peuvent plus répondre. Les résultats restent disponibles.",
      keepPlaying: "Continuer à jouer",
      deleteGameTitle: "Supprimer ce jeu ?",
      deleteGameDesc:
        "Le jeu, ses manches et tous les records de joueurs seront définitivement supprimés.",
      keepIt: "Conserver",
      copied: "Copié !",
      classesTitle: "Classes",
      classesSub: "Regroupez vos élèves, partagez un code, assignez des quiz à une classe.",
      createClass: "Créer une classe",
      createClassSub: "Partagez le code avec vos élèves.",
      className: "Nom de la classe",
      classNamePlaceholder: "ex. Groupe Coran A",
      classDescription: "Description (facultatif)",
      classDescriptionPlaceholder: "ex. Deuxième période, débutants",
      createdToast: "Classe créée",
      createdToastDesc: "Partagez le code avec vos élèves.",
      createFailed: "Impossible de créer la classe",
      membersLabel: "Membres",
      archiveLabel: "Archiver",
      archivedToast: "Classe archivée",
      archivedToastDesc: "Les élèves ne peuvent plus la rejoindre.",
      archiveTitle: "Archiver cette classe ?",
      archiveDesc: "n'acceptera plus de nouveaux membres. Les devoirs existants restent.",
      keepClass: "Garder la classe",
      archivedBadge: "Archivée",
      noMembers: "Aucun membre pour l'instant",
      noMembersDesc: "Partagez le code de la classe pour que les élèves la rejoignent.",
      memberRemoved: "Membre retiré",
      removeMemberFailed: "Impossible de retirer le membre",
      noClassesYet: "Aucune classe pour l'instant",
      copyFailedDesc: "Sélectionnez le code manuellement.",
      membersLoadFailed: "Chargement des membres impossible",
      createFailedDesc: "Vérifiez le nom et réessayez.",
      memberWord: "membres",
      gameWord: "jeux",
      copyClassCode: "Copier le code de la classe",
      membersJoinHint: "Les élèves rejoignent depuis leur page de classes.",
      joinedOn: "Rejoint",
      removeMember: "Retirer",
      noClassesYetDesc: "Créez votre première classe et partagez son code.",
      copyFailed: "Copie impossible",
      codeCopied: "Code copié",
      codeCopiedDesc: "Code de classe",
      analyticsTitle: "Analytics",
      analyticsSub: "Score, précision, temps de réponse et questions manquées par vos joueurs.",
      manageGames: "Gérer les jeux",
      gamesLaunched: "Jeux lancés",
      averageScore: "Score moyen",
      averageAccuracy: "Précision moyenne",
      avgResponseTime: "Temps de réponse moyen",
      mostMissed: "Questions les plus ratées",
      mostMissedSub: "Questions le plus souvent ratées dans le jeu",
      answersCount: "réponses",
      noAnswers: "Pas encore de réponses",
      nothingMissed: "Rien de raté",
      nothingMissedDesc: "Aucune mauvaise réponse enregistrée pour ce jeu.",
      wrongAnswers: "ratées",
      correctPct: "% correctes",
      questions: "Questions",
      answers: "Réponses",
      gameBadgeFinished: "Terminé",
      gameBadgeCancelled: "Annulé",
      gameBadgeRunning: "En cours",
      gameBadgeWaiting: "En attente de joueurs",
      gameBadgePaused: "En pause",
      loadAnalyticsFailed: "Impossible de charger les analytics",
      loadGamesFailed: "Impossible de charger vos jeux",
      statQuestions: "Questions",
      statAnswers: "Réponses",
      inGame: "Dans le jeu {code}",
      pickAnotherGame: "Réessayez, ou choisissez un autre jeu.",
    },
    editor: {
      settings: "Paramètres",
      quizName: "Nom du quiz",
      language: "Langue",
      category: "Catégorie",
      categoryPlaceholder: "ex. Mémorisation",
      difficulty: "Difficulté",
      difficultyAny: "Toute",
      difficultyEasy: "Facile",
      difficultyMedium: "Moyen",
      difficultyHard: "Difficile",
      defaultPoints: "Points par défaut par question",
      defaultNegativePoints: "Points négatifs par défaut (mauvaise réponse)",
      classOptional: "Classe (facultatif)",
      noClass: "Aucune classe",
      description: "Description (affichée aux joueurs)",
      descriptionPlaceholder: "ex. Sourate Al-Baqara, versets 1–10",
      speedBonus: "Accorder un bonus de rapidité pour les bonnes réponses",
      questions: "Questions",
      addQuestion: "Ajouter une question",
      noDescription: "Aucune description",
      editLabel: "Modifier",
      openLabel: "Ouvrir",
      duplicateAction: "Dupliquer",
      createQuiz: "Créer un quiz",
      createSub: "Vous ajouterez les questions juste après — le quiz reste un brouillon jusqu'au lancement.",
      quizNamePlaceholder: "ex. Bases de la sourate Al-Baqara",
      createAndAdd: "Créer et ajouter les questions",
      quizCreated: "Quiz créé",
      quizCreatedDesc: "Ajoutez maintenant vos questions.",
      createFailed: "Impossible de créer le quiz.",
      quizNameRequired: "Donnez d'abord un nom à votre quiz.",
      saveChanges: "Enregistrer",
      savedToastTitle: "Quiz enregistré",
      savedToastDesc: "Toutes les modifications sont stockées.",
      saveFailed: "Une erreur est survenue lors de l'enregistrement.",
      launchGame: "Lancer le jeu en direct",
      launchToastTitle: "Jeu lancé",
      launchToastDesc: "La salle est ouverte — partagez le code.",
      launchFailed: "Réessayez.",
      launchDialogTitle: "Lancer ce quiz ?",
      launchDialogDesc: "Le code de la salle est",
      launchDialogKeep: "Continuer l'édition",
      launchDialogConfirm: "Lancer le jeu",
      deleteQuestion: "Supprimer la question",
      preview: "Aperçu",
      backToLibrary: "Retour à la bibliothèque",
      exitEditing: "Quitter l'éditeur",
      exitConfirmTitle: "Quitter l'éditeur ?",
      exitConfirmDesc: "Les modifications non enregistrées seront perdues.",
      exitConfirmKeep: "Rester ici",
      exitConfirmLeave: "Quitter",
      typeLabel: "Type",
      typeMcq: "Choix multiple",
      typeTrueFalse: "Vrai / Faux",
      typeText: "Réponse courte",
      typeNumber: "Nombre",
      typeAudio: "Audio",
      questionText: "Texte de la question",
      questionTextPlaceholder: "Saisissez la question…",
      choices: "Choix",
      choiceLabel: "Choix",
      addChoice: "Ajouter un choix",
      correctAnswer: "Bonne réponse",
      markCorrect: "Marquer comme correct",
      duration: "Durée (secondes)",
      seconds: "s",
      pointsPerQuestion: "Points",
      default: "défaut",
      negativePoints: "Points négatifs",
      explanation: "Explication (facultatif)",
      explanationPlaceholder: "Affichée après la fermeture de la question…",
      surahRef: "Référence coranique",
      surah: "Sourate",
      ayah: "Verset",
      page: "Page",
      juz: "Juz",
      hizb: "Hizb",
      missingText: "Le texte de la question est requis.",
      missingChoices: "Chaque choix doit avoir un texte.",
      missingTwoChoices: "Ajoutez au moins deux choix.",
      missingCorrectMarker: "Marquez un choix comme correct.",
      missingCorrectText: "Saisissez le texte de la bonne réponse.",
      missingDuration: "La durée doit être d'au moins 5 secondes.",
      missingPoints: "Les points ne peuvent pas être négatifs.",
      errorSummary: "Certaines questions sont incomplètes ; corrigez-les avant d'enregistrer.",
      notDraftLocked: "L'édition est verrouillée une fois le jeu lancé.",
      moveUp: "Monter",
      moveDown: "Descendre",
      loadTitle: "Impossible d'ouvrir ce quiz",
      loadNotFound: "Quiz introuvable ou accès refusé.",
      loadFailed: "Échec du chargement du quiz.",
      backToQuizzes: "Retour à mes quiz",
      checkErrors: "Vérifiez les erreurs",
      checkErrorsDesc: "Certaines questions sont incomplètes ; corrigez-les avant d'enregistrer.",
      saveFailedTitle: "Échec de l'enregistrement",
      launchFailedTitle: "Échec du lancement",
      untitledQuiz: "Quiz sans titre",
      untitledQuestion: "Question sans titre",
      unsaved: "Non enregistré",
      discard: "Abandonner",
      addQuestionsFirst: "Ajoutez d'abord des questions",
      launched: "Lancé",
      backToEditing: "Retour à l'édition",
      incomplete: "Incomplet",
      launchDialogLocked: "Les joueurs peuvent rejoindre dès l'ouverture du hall — l'édition sera verrouillée.",
      onlyOneCorrect: "Une seule option peut être la bonne réponse.",
      chooseCorrect: "Choisissez la bonne réponse.",
      optionsMark: "Options — cochez la bonne",
      markOptionAria: "Marquer l'option {n} comme correcte",
      removeOptionAria: "Supprimer l'option {n}",
      optionWord: "Option",
      addOption: "Ajouter une option",
      trueOption: "Vrai",
      falseOption: "Faux",
      correctNumeric: "Bonne réponse numérique",
      correctTextHint: "Bonne réponse (correspondance exacte, insensible à la casse)",
      expected: "Attendue",
    },
    game: {
      lobbyTitle: "Salle d'attente",
      lobbySub: "Préparez votre appareil — l'hôte va lancer les questions.",
      waitingForPlayers: "En attente de joueurs",
      startingSoon: "Le jeu n'a pas encore commencé.",
      gameEnded: "Le jeu est terminé.",
      leaveLobby: "Quitter la salle",
      playerCount: "joueurs rejoints",
      questionTitle: "Question",
      waitingForQuestion: "L'hôte n'a pas encore envoyé de question.",
      pausedOverlay: "En pause",
      pausedOverlayDesc: "L'hôte a mis le jeu en pause — tenez bon.",
      submitAnswer: "Envoyer la réponse",
      answerLocked: "Réponse verrouillée",
      skipped: "Passée",
      correct: "Correcte",
      wrong: "Fausse",
      feedback: "Résultat",
      youAnswered: "Vous avez répondu :",
      correctAnswerIs: "Bonne réponse :",
      explanation: "Explication",
      next: "Suivant",
      resultTitle: "Résultats du jeu",
      yourScore: "Votre score",
      yourRank: "Votre rang",
      ofPlayers: "sur",
      leaderboard: "Classement",
      podium: "Podium",
      yourAnswers: "Vos réponses",
      timeUp: "Temps écoulé !",
      answerNow: "Répondez maintenant",
      kbdChoice: "Appuyez sur 1-4 pour choisir",
      networkError: "Connexion perdue — reconnexion…",
      retryJoin: "Reconnecter",
      sessionExpired: "Votre session a expiré. Rejoignez à nouveau.",
      backToLobby: "Retour à la salle",
      answeredCount: "ont répondu",
      playersAnswered: "joueurs ont répondu",
      connecting: "Connexion au jeu…",
      connectError: "Jeu injoignable. Vérifiez votre connexion.",
      notAvailableTitle: "Jeu indisponible",
      notAvailableDesc: "Ce jeu a été fermé par l'hôte ou n'est plus joignable.",
      you: "Vous",
      questionOf: "Question {position} sur {total}",
      scoreLabel: "Score : {total}",
      pickAnswerError: "Choisissez une réponse avant d'envoyer.",
      questionClosedError: "Cette question vient de se fermer. Attendez que l'hôte continue.",
      sendAnswerFailed: "Envoi de votre réponse impossible",
      gettingReady: "Préparation…",
      hostAboutToStart: "L'hôte va bientôt lancer une question.",
      answerSubmitted: "Réponse envoyée",
      waitingTimer: "En attente de la fin du minuteur…",
      wrongAnswer: "Mauvaise réponse",
      noAnswerSubmitted: "Aucune réponse envoyée",
      youPickedThis: "Vous avez choisi ceci",
      why: "Pourquoi",
      revealingAnswer: "Dévoilement de la réponse…",
      loadingResults: "Chargement des résultats…",
      gameEndedTitle: "Jeu terminé",
      leaveGame: "Quitter le jeu",
      answerChoicesLabel: "Choix de réponses",
      typeNumber: "Saisissez un nombre…",
      typeAnswer: "Saisissez votre réponse…",
      gameStillRunning: "Le jeu est toujours en cours",
      resultsAfterFinish: "Les résultats apparaissent une fois le jeu terminé par l'hôte.",
      backToGame: "Retour au jeu",
      gameFinishedTitle: "Jeu terminé !",
      yourResultIntro: "{name}, voici votre résultat.",
      returnHome: "Retour à l'accueil",
      firstPlace: "1er",
      secondPlace: "2e",
      thirdPlace: "3e",
    },
  },
};

export const localeNames: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
  fr: "Français",
};