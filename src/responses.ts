const randomResponse = (contents: string[]) => {
  return contents[Math.floor(Math.random() * contents.length)] as string;
};

export const RESPONSES = {
  noImageInMessage: () =>
    randomResponse([
      "Huh? Where's the image?",
      "I don't see any image here...",
      "Save what?",
      "Image? Where?",
    ]),
  normalError: () =>
    randomResponse([
      "I can't do that! I'm hungry.",
      "Do it yourself.",
      "I'm not doing that.",
      "I'm not in the mood.",
      "I can't do that! I'm busy.",
      "I'm late for school, come back later.",
    ]),
  bookmarkNotFound: () =>
    randomResponse([
      "I couldn't find it.",
      "I don't have that.",
      "I don't know that.",
      "I don't know where that is.",
      "I forgot about that.",
    ]),
  sucess: () =>
    randomResponse([
      "Ok",
      "Got it",
      "Sure",
      "Alright",
      "Done",
      ":D",
      "👌",
      "👍",
    ]),
  noReplyReference: () =>
    randomResponse([
      "That message isn't a reply to anything.",
      "Reply to an image message first, then I'll analyze it.",
      "I need a reply to know which image to save.",
    ]),
  noMessageId: () =>
    randomResponse([
      "Where's the message link?",
      'I need a message link like `Save this https://discord.com/channels/... as "name"`.',
      "I can't do that.",
    ]),
  messageNotFound: () =>
    randomResponse([
      "I couldn't find the message.",
      "Does that message exist?",
      "Uh... that message is gone. Maybe the cat ate it.",
    ]),
  missingAccess: (isDmLink?: boolean) =>
    isDmLink
      ? randomResponse([
          "I can't access that DM. Use a server message link, or bookmark from a channel I'm in.",
          "That's a private DM I wasn't in. I can only read server channels I have access to.",
        ])
      : randomResponse([
          "I don't have access to that channel.",
          "I can't see that message. Am I even in that server?",
          "Missing access. Try a channel I can actually read.",
        ]),
};
