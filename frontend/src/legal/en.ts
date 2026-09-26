import { PLAN, MAX_EDITS } from '@shared/seller.js'
import { RENEW_REMINDER_DAYS } from '@shared/subscription.js'
import { REVIEW_WINDOW_DAYS } from '@shared/review.js'
import { UNDO_DAYS } from '@shared/accountClose.js'
import {
  COURTS, FEE_REFUND_WORKING_DAYS, GRIEVANCE_ACK_HOURS, GRIEVANCE_OFFICER,
  GRIEVANCE_RESOLVE_DAYS, OPERATOR, RETURN_REPORT_HOURS, SECURITY_LOG_DAYS,
} from './operator.js'
import type { LegalSet } from './types.js'

/**
 * THE POLICIES, IN ENGLISH.
 *
 * Written for a reader, not a court: short sentences, the thing she needs to
 * know first, and every number taken from the code that enforces it. This is
 * an independent piece of writing from mr.ts - the two say the same things,
 * and a change to one is a reason to re-read the other, never to transliterate.
 *
 * Every claim here about what the app does is a claim about code. When the
 * code changes what is collected, who sees it, what she pays or what she is
 * responsible for, this text changes with it and POLICY_VERSION moves.
 */

const officer = `${GRIEVANCE_OFFICER.nameEn}, ${GRIEVANCE_OFFICER.roleEn}`
const contact = `phone ${GRIEVANCE_OFFICER.phone}, email ${GRIEVANCE_OFFICER.email}`

export const en: LegalSet = {
  /* ================================================================ */
  privacy: {
    title: 'Privacy Policy',
    summary: 'What we collect, why, who can see it, how long we keep it, and your rights.',
    sections: [
      {
        id: 'who',
        heading: 'Who we are',
        body: [
          `Shantai Mahila Bazar is run by ${OPERATOR.nameEn}, ${OPERATOR.addressEn} ("the college", "we"). The college decides what information this app collects and why, and is responsible for it under the Digital Personal Data Protection Act, 2023.`,
          'This policy covers the Shantai Mahila Bazar app, its website, and the Android app that opens it.',
        ],
      },
      {
        id: 'collect',
        heading: 'What we collect',
        body: [
          'From everyone:',
          {
            list: [
              'Your mobile number, to send the one-time password (OTP) you sign in with.',
              'Your name.',
              'A record of each sign-in: when it started, when it was last used, and the kind of phone or browser. This is how you can be signed out of a lost phone.',
              `Security logs of sign-in attempts, with the phone number partly hidden and the internet address scrambled so it cannot be read back. These are deleted after ${SECURITY_LOG_DAYS} days.`,
              'In the Android app, a notification token, so we can send order updates to your phone.',
            ],
          },
          'From buyers:',
          {
            list: [
              'Delivery addresses you save, and the address, items and amounts of each order.',
              'The UPI transaction number (UTR) you enter when you pay a seller.',
              'Your ratings and reviews, and any listing or review you report.',
            ],
          },
          'From sellers:',
          {
            list: [
              'What you tell us at registration: age and education (both optional), WhatsApp number, village, taluka, district and pincode, shop name and description, self-help group, years in business, how much you can make in a month, whether you sell food, and your FSSAI number if you have one.',
              'Your UPI ID and, if you upload it, a photo of your bank\'s QR code.',
              'Your answers to the six digital-readiness questions, and what the app measures about how you use it.',
              'Your product listings and their photos.',
              'For each ₹50 payment: a screenshot of the payment, the time you say you paid, and the UTR.',
              'Complaints you send from the Help & Training screen.',
            ],
          },
          'We do not collect your location, your contacts, your call history or anything from your camera. We do not use advertising or tracking tools.',
        ],
      },
      {
        id: 'why',
        heading: 'Why we collect it',
        body: [
          {
            list: [
              'To sign you in and keep your account safe.',
              'To show a seller\'s shop and products to buyers.',
              'To pass an order between the buyer and the seller, with what each needs to deliver and to be paid.',
              'To check the ₹50 payments sellers make to the college.',
              'To check listings before they go live, and to act on reports and complaints.',
              'To send order and account updates to your phone.',
              'To measure what this programme changes for the women in it. For this we use totals and averages only; no seller is named in any report.',
              'To meet our legal duties.',
            ],
          },
          'We will not sell your information, and we will not use it for advertising.',
        ],
      },
      {
        id: 'who-sees',
        heading: 'Who can see your information',
        body: [
          {
            list: [
              'Anyone, without signing in, can see a seller\'s public shop card: name, photo, shop name, SMB ID, village, delivery terms, the pincodes she delivers to, her UPI ID and QR code, and her rating. They can also see her live products and their reviews. A reviewer is shown by first name only.',
              'A seller\'s phone number is shown only to a buyer who has placed an order with her, on that order.',
              'A seller sees the name, phone number and delivery address of each buyer who orders from her.',
              'A seller never learns who reported her listing.',
              'College staff who run the market can see all of the above, so they can check listings and payments and answer complaints. Only named staff with their own password have this access.',
              'We share information with the police, courts or government only when the law requires it.',
            ],
          },
        ],
      },
      {
        id: 'providers',
        heading: 'Services that handle it for us',
        body: [
          'We use these companies to run the app. They process your information only to provide their service to us:',
          {
            list: [
              'Google Cloud and Firebase (Google): the server, the database, and phone notifications.',
              'Cloudinary: storing and resizing photos, including payment screenshots and QR codes.',
              'Vercel: hosting the website.',
              'MSG91: sending the OTP by SMS.',
              'Google speech recognition: only when you tap the microphone to speak instead of typing. Your phone sends that recording to Google to turn it into words; we never receive the recording.',
            ],
          },
          'Some of these services may store information on servers outside India. We use them only as the law allows.',
        ],
      },
      {
        id: 'retention',
        heading: 'How long we keep it',
        body: [
          'We keep your information while your account is open.',
          'You can delete your account from the My Profile screen, or ask us to (see "How to delete your account" below). What happens then:',
          {
            list: [
              `A seller's shop closes at once and she is signed out everywhere. After ${UNDO_DAYS} days her name, phone, address, UPI ID, QR code, photos, readiness answers and payment screenshots are erased. She can stop this by signing in during those ${UNDO_DAYS} days.`,
              'A buyer\'s account is closed at once. Her name, phone and address are removed from her past orders, and her reviews keep their stars but lose her name.',
              'We keep past orders (what was bought, the price, the date and the pincode), because they are also the other person\'s record.',
              'We keep the record of each ₹50 payment (the amount, the date and the UTR) for as long as the college\'s accounting rules require.',
              'We keep complaints, without your contact details, as a record of how they were handled.',
            ],
          },
          'We keep backup copies of the database so the market can be restored after a failure. Deleted information can stay in a backup for a limited time until it is replaced. A backup is never used to bring back an account you deleted.',
        ],
      },
      {
        id: 'rights',
        heading: 'Your rights',
        body: [
          'Under the Digital Personal Data Protection Act, 2023, you can:',
          {
            list: [
              'See the information we hold about you. Most of it is on your My Profile screen; ask the grievance officer for the rest.',
              'Correct it. You can edit your profile yourself, or ask us.',
              'Have it erased, by deleting your account.',
              'Withdraw your consent. Because the app cannot work without this information, withdrawing consent means deleting your account. It does not undo what was done lawfully before.',
              'Name another person to use these rights for you if you die or become unable to.',
              'Complain to our grievance officer, and after that to the Data Protection Board of India.',
            ],
          },
          `To use any of these rights, contact ${officer}: ${contact}.`,
        ],
      },
      {
        id: 'delete',
        heading: 'How to delete your account',
        body: [
          'In the app: open My Profile and tap "Delete my account" at the very bottom.',
          `Without the app: open the "Delete your account" page on our website (linked at the bottom of the home page), or phone or WhatsApp ${GRIEVANCE_OFFICER.phone}.`,
          'An account with an order still in progress cannot be deleted until that order is finished or cancelled, so that nobody is left waiting for a delivery or a payment.',
        ],
      },
      {
        id: 'children',
        heading: 'Children',
        body: ['This app is for people aged 18 and over. We do not knowingly collect information about anyone younger. If you think a child has made an account, tell the grievance officer and we will delete it.'],
      },
      {
        id: 'security',
        heading: 'How we protect it',
        body: [
          {
            list: [
              'Every connection to the app is encrypted.',
              'You sign in with a one-time password sent to your own phone. There is no password to steal.',
              'Signing out, or deleting your account, ends your sign-in on every phone at once.',
              'The database cannot be read from outside; only our own server can reach it.',
              'Only named college staff with their own password can use the admin console.',
            ],
          },
          'No system is perfectly safe. If a breach affects your information, we will tell you and the Data Protection Board as the law requires.',
        ],
      },
      {
        id: 'phone',
        heading: 'What the Android app asks your phone for',
        body: [
          {
            list: [
              'Notifications: to tell you about orders. You can turn them off in your phone\'s settings.',
              'Microphone: only while you are using the microphone button to speak instead of type.',
              'Photos: only the photo you choose from your gallery, when you add a product photo, QR code or payment screenshot.',
            ],
          },
          'The app also saves a few things on your own phone: your sign-in, your language, your basket, and a half-filled form so you do not lose it. Signing out clears your sign-in.',
        ],
      },
      {
        id: 'changes',
        heading: 'Changes to this policy',
        body: ['If we change what we collect, who sees it or why, we will show you the new policy in the app and ask you to accept it before you carry on. The date at the top of this page shows when it last changed.'],
      },
      {
        id: 'contact',
        heading: 'Contact',
        body: [`Grievance officer: ${officer}. ${contact[0]!.toUpperCase()}${contact.slice(1)}.`],
      },
    ],
  },

  /* ================================================================ */
  terms: {
    title: 'Terms of Use',
    summary: 'The rules for using the market, for buyers and sellers alike.',
    sections: [
      {
        id: 'about',
        heading: 'What this app is',
        body: [
          `Shantai Mahila Bazar is an online market for products made by rural women in Maharashtra. It is run by ${OPERATOR.nameEn}, ${OPERATOR.addressEn}.`,
          'The college runs the market; it does not sell anything itself. Each product is sold by the seller whose shop it is in, and the sale is between the buyer and that seller.',
          'By using the app you agree to these terms, the Privacy Policy and the Returns and Refunds Policy. Sellers also agree to the Seller Agreement.',
        ],
      },
      {
        id: 'who-may',
        heading: 'Who may use it',
        body: [
          'You must be 18 or older and able to make a contract under Indian law.',
          'One account per mobile number. You are responsible for what is done from your account, so do not let anyone else sign in with your OTP.',
          'The information you give must be true.',
        ],
      },
      {
        id: 'ordering',
        heading: 'How ordering works',
        body: [
          {
            list: [
              'Orders can be delivered only to pincodes in Maharashtra.',
              'Your basket holds products from one shop at a time.',
              'When you place an order, the seller decides whether she can deliver it. She may accept or reject it.',
              'If the delivery charge shows "ask the seller", the seller will tell you the charge. Her phone number appears on your order as soon as you place it.',
              'The seller tells you how long delivery will take, and she arranges the delivery herself.',
            ],
          },
        ],
      },
      {
        id: 'payment',
        heading: 'Payment goes straight to the seller',
        body: [
          {
            list: [
              'You pay only after the seller accepts your order, by UPI, directly into the seller\'s own account. The app shows her QR code and UPI ID and the amount to pay.',
              'The college never receives, holds or passes on the money for an order.',
              'After paying, enter the 12-digit UTR number from your UPI app. The seller checks her account and confirms the payment before she sends the order.',
              'Check the name your UPI app shows before you pay. The college cannot reverse a payment made to the wrong person.',
            ],
          },
        ],
      },
      {
        id: 'cancel',
        heading: 'Cancelling',
        body: [
          'You can cancel an order yourself only before the seller accepts it. After that, phone the seller; she can cancel it and must return anything you have paid. The Returns and Refunds Policy has the details.',
        ],
      },
      {
        id: 'reviews',
        heading: 'Ratings and reviews',
        body: [
          {
            list: [
              `After an order is delivered, you are asked to rate each product in it. Until orders delivered in the last ${REVIEW_WINDOW_DAYS} days are rated, you cannot place a new order.`,
              'Ratings are public and show your first name only.',
              'Only a buyer who received the product can review it.',
              'Write about the product and your experience. Do not write anything abusive, false, obscene, hateful, or anything that reveals somebody\'s personal details.',
              'The college may hide a review that breaks these rules. It will tell you that it was hidden.',
            ],
          },
        ],
      },
      {
        id: 'report',
        heading: 'Reporting a listing or a review',
        body: [
          'Buyers can report a listing, and buyers and sellers can report a review, with the Report button beside it. Choose a reason. A report does not remove anything by itself: college staff look at it and decide. The seller is never told who reported her.',
        ],
      },
      {
        id: 'not-allowed',
        heading: 'What is not allowed',
        body: [
          {
            list: [
              'Selling or listing anything illegal, unsafe, stolen, counterfeit, or that needs a licence you do not have.',
              'Alcohol, tobacco, drugs, medicines, weapons, or animal products whose sale is banned.',
              'Photos you do not own, or photos of somebody else\'s product.',
              'False claims about a product, its ingredients or its price.',
              'Harassing, threatening or cheating a buyer, a seller or college staff.',
              'Fake orders, fake reviews, or trying to break or misuse the app.',
            ],
          },
          'The college may remove content or block an account that breaks these rules. It will tell the account holder why.',
        ],
      },
      {
        id: 'responsibility',
        heading: 'Who is responsible for what',
        body: [
          'Each seller is responsible for her products: their quality, safety, description, packing and delivery, and for any licence they need. College staff check each listing before it goes live, but that check is not a guarantee of the product.',
          'As far as the law allows, the college is not responsible for loss from a sale between a buyer and a seller, from a payment made to the wrong account, or from the app being unavailable for a time. Nothing in these terms takes away a right you have under the Consumer Protection Act, 2019.',
        ],
      },
      {
        id: 'close',
        heading: 'Closing your account',
        body: ['You can delete your account at any time from the My Profile screen. The Privacy Policy explains what is erased and what is kept.'],
      },
      {
        id: 'changes',
        heading: 'Changes to these terms',
        body: ['If we change these terms, we will show you the new terms in the app and ask you to accept them before you carry on.'],
      },
      {
        id: 'law',
        heading: 'Law and disputes',
        body: [
          `These terms are governed by the laws of India. Please bring any problem to our grievance officer first. If it cannot be settled, the courts at ${COURTS.en}, Maharashtra, will hear it.`,
        ],
      },
    ],
  },

  /* ================================================================ */
  seller: {
    title: 'Seller Agreement',
    summary: 'What a seller pays, what she agrees to, and what she is responsible for.',
    sections: [
      {
        id: 'agreement',
        heading: 'This agreement',
        body: [
          `This is an agreement between you, the seller, and ${OPERATOR.nameEn} ("the college"), which runs Shantai Mahila Bazar. You accept it when you register as a seller. The Terms of Use, the Privacy Policy and the Returns and Refunds Policy apply to you too.`,
        ],
      },
      {
        id: 'register',
        heading: 'Registering',
        body: [
          {
            list: [
              'You must be 18 or older, and the information you give must be true and yours.',
              'You get an SMB ID. It names your village and can be printed on your packaging.',
              'The UPI ID you give is where buyers will pay you. Check it carefully: a wrong UPI ID sends buyers\' money to a stranger.',
            ],
          },
        ],
      },
      {
        id: 'fee',
        heading: `The ₹${PLAN.price} fee`,
        body: [
          {
            list: [
              `₹${PLAN.price} buys a pack of ${PLAN.slotsPerPack} places. Each place holds one product.`,
              `Your shop stays open for ${PLAN.months} months from the day the college approves your payment.`,
              `Renewal is ₹${PLAN.price} for the whole shop, however many packs you have, and can be paid from ${RENEW_REMINDER_DAYS} days before the end. A renewal paid early is added to the end date, so you lose no days.`,
              'If every place is full, you can buy another pack. It adds places and does not change the end date.',
              'You pay by UPI to the college\'s account shown in the app, then send a screenshot of the payment, the time you paid and the UTR. College staff check it against the bank statement before approving.',
              `Once approved, the fee is not refunded, including if you later delete your account. If the college rejects your payment, the money is returned to the account it came from within ${FEE_REFUND_WORKING_DAYS} working days.`,
            ],
          },
          'If your shop\'s time runs out, buyers stop seeing it until you renew. Nothing is deleted: your products, places and orders stay as they were, and orders already in progress carry on.',
        ],
      },
      {
        id: 'listings',
        heading: 'Your listings',
        body: [
          {
            list: [
              'College staff check every listing before buyers can see it. A listing that is refused is removed, and you are told why. Its place becomes free again.',
              'The photo must be of your own product, taken by you or with permission.',
              'The name, price, MRP, size, ingredients and veg or non-veg mark must be true.',
              `Once a listing is live, its main details can be changed ${MAX_EDITS} times. Price and stock can be changed at any time.`,
              'You cannot delete a listing yourself after sending it for checking. Ask college staff if you want one taken down.',
              'The college may take down a live listing that breaks the rules or is reported with good reason.',
            ],
          },
        ],
      },
      {
        id: 'food',
        heading: 'Food products',
        body: [
          {
            list: [
              'Food businesses in India must have FSSAI registration or a licence. Getting and keeping it is your responsibility. For a small home business, basic FSSAI registration is enough, and the college can help you apply.',
              'If you have an FSSAI number, add it to your listing so buyers can see it.',
              'Make food cleanly and safely, and mark packets with the product name, weight or quantity, price, date made and best-before date.',
            ],
          },
        ],
      },
      {
        id: 'orders',
        heading: 'Orders, payment and delivery',
        body: [
          {
            list: [
              'Accept an order only if you can deliver it. An order from outside your usual pincodes is marked so you can decide.',
              'Buyers pay into your own UPI account after you accept. Confirm a payment only after you see it in your UPI app or bank: a UTR number alone is not proof.',
              'Delivery is yours to arrange. Tell the buyer how long it will take.',
              'If you cancel an order after the buyer has paid, you must return the money yourself. The app does not move money.',
              `If a buyer tells you within ${RETURN_REPORT_HOURS} hours of delivery that an item is wrong or damaged, you must replace it or refund it. See the Returns and Refunds Policy.`,
              'You are responsible for any tax or registration your business needs.',
            ],
          },
        ],
      },
      {
        id: 'public',
        heading: 'What buyers see about you',
        body: [
          'Your shop card is public: name, photo, shop name, SMB ID, village, delivery terms, the pincodes you deliver to, UPI ID and QR code, and the rating from your products\' reviews. Your phone number is shown only to buyers who have ordered from you, on their order. The Privacy Policy has the rest.',
        ],
      },
      {
        id: 'block',
        heading: 'Blocking an account',
        body: [
          'The college may block a seller who breaks this agreement or the Terms of Use, cheats buyers, or gives false information. You will be told the reason in the app. To ask for it to be reviewed, contact the grievance officer.',
        ],
      },
      {
        id: 'leaving',
        heading: 'Leaving',
        body: [
          `You can delete your account from the My Profile screen. Your shop closes at once, and your information is erased after ${UNDO_DAYS} days unless you sign in and stop it. You must finish or cancel any order in progress first. The fee you paid is not refunded.`,
        ],
      },
    ],
  },

  /* ================================================================ */
  refunds: {
    title: 'Returns and Refunds',
    summary: 'Cancelling an order, wrong or damaged items, and the seller fee.',
    sections: [
      {
        id: 'direct',
        heading: 'First: the money goes to the seller',
        body: ['Buyers pay sellers directly by UPI. The college never holds the money for an order, so every refund for an order comes from the seller, not from the college.'],
      },
      {
        id: 'cancel-buyer',
        heading: 'If you cancel',
        body: [
          'You can cancel an order in the app until the seller accepts it. You have not paid anything yet, so there is nothing to refund.',
          'After the seller accepts it, the Cancel button is gone. Phone the seller and ask her to cancel.',
        ],
      },
      {
        id: 'cancel-seller',
        heading: 'If the seller rejects or cancels',
        body: [
          'A seller may reject an order before accepting it; you have not paid, so nothing is owed.',
          'If she cancels after accepting it, she must return everything you paid, to the account you paid from. The app reminds her of this, and the cancelled order shows that a refund is due.',
        ],
      },
      {
        id: 'returns',
        heading: 'Wrong or damaged items',
        body: [
          'Because most products here are fresh, homemade food, there are no returns for a change of mind.',
          `If an item is wrong, damaged or spoiled when it arrives, tell the seller within ${RETURN_REPORT_HOURS} hours of delivery, with a photo if you can. She must replace it or refund you for it.`,
          'If the seller does not answer or refuses, contact the grievance officer. The college will contact the seller, and may act against a seller who does not put it right.',
        ],
      },
      {
        id: 'fee',
        heading: `The ₹${PLAN.price} seller fee`,
        body: [
          {
            list: [
              'Once the college approves a payment, it is not refunded, including if the seller later deletes her account.',
              `If the college rejects a payment, the money is returned to the account it came from within ${FEE_REFUND_WORKING_DAYS} working days.`,
              'Paid by mistake, or paid twice? Contact the grievance officer with the UTR.',
            ],
          },
        ],
      },
    ],
  },

  /* ================================================================ */
  grievance: {
    title: 'Grievances and Contact',
    summary: 'Who runs the market, and who to contact when something goes wrong.',
    sections: [
      {
        id: 'operator',
        heading: 'Who runs this market',
        body: [`${OPERATOR.nameEn}, ${OPERATOR.addressEn}.`],
      },
      {
        id: 'officer',
        heading: 'Grievance officer',
        body: [
          `${officer}.`,
          { list: [`Phone and WhatsApp: ${GRIEVANCE_OFFICER.phone}`, `Email: ${GRIEVANCE_OFFICER.email}`] },
          'She is also the person to contact about your personal information and your rights under the Digital Personal Data Protection Act, 2023.',
        ],
      },
      {
        id: 'how',
        heading: 'How to complain',
        body: [
          {
            list: [
              'Sellers: use the complaint form on the Help & Training screen. It is recorded against your account, so the matter can be tracked.',
              'Anyone: phone, WhatsApp or email the grievance officer.',
              'Say who you are, the order number or the listing if there is one, and what went wrong.',
            ],
          },
        ],
      },
      {
        id: 'timing',
        heading: 'When you will hear back',
        body: [`We will acknowledge your complaint within ${GRIEVANCE_ACK_HOURS} hours and try to resolve it within ${GRIEVANCE_RESOLVE_DAYS} days.`],
      },
      {
        id: 'further',
        heading: 'If you are not satisfied',
        body: [
          'For a complaint about a purchase, you can go to the consumer commission, or call the National Consumer Helpline on 1915.',
          'For a complaint about your personal information, you can go to the Data Protection Board of India.',
        ],
      },
    ],
  },
}
