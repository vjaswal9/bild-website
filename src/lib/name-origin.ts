// Name-based origin estimate, used as a soft corroboration signal for the
// British Indian heritage that applicants declare on the join form.
//
// IMPORTANT: this is a transparent keyword heuristic, not a trained model. It
// matches given names and surnames against lists of names common in the Indian
// (especially UK-diaspora Gujarati/Punjabi/South Indian/Bengali) community.
// It WILL be wrong on Anglicised first names, married surnames, mixed heritage
// and converts, so it is always labelled as an estimate and must never be the
// sole basis for accepting or rejecting a member. The member's own declared
// answers (heritage confirmation, UK city, family's Indian city) come first.
//
// It is computed on demand from the name and deliberately NOT stored in the
// database, so no inferred data is retained against a member record.

const SURNAMES = [
  // Gujarati / Kutchi / Lohana (very common in the UK diaspora)
  'patel','shah','desai','mehta','amin','solanki','parmar','vora','doshi','zaveri','thakkar','thakrar',
  'vyas','pandya','raval','soni','joshi','trivedi','dave','bhatt','modi','gandhi','kotecha','popat',
  'halai','bhudia','rabadia','vekaria','karia','hirani','devani','ladwa','chandarana','depala','gudka',
  'kerai','nathwani','jethwa','odedra','bhanderi','varsani','morjaria','sanghrajka','pindoria','makwana',
  'chotai','tanna','mistry','sondhi','lakhani','manek','vaghela','chauhan','rathod','gohil','jadeja',
  // Punjabi / Sikh
  'singh','kaur','gill','sandhu','dhillon','sidhu','bajwa','brar','mann','sangha','chahal','randhawa',
  'virk','bhullar','toor','sahota','bassi','jaswal','grewal','dhaliwal','sekhon','hayer','johal','heer',
  'sohal','purewal','nagra','kalsi','matharu','rai','sian','dosanjh','chana','panesar','flora','bhambra',
  // North Indian / Hindi belt
  'sharma','kumar','gupta','agarwal','aggarwal','bansal','mittal','goyal','garg','jindal','arora','sethi',
  'bhatia','sachdeva','anand','kohli','malhotra','kapoor','khanna','chopra','tandon','nanda','sood',
  'saxena','srivastava','shukla','tiwari','mishra','pandey','dubey','chaturvedi','bhardwaj','verma',
  'yadav','jain','sinha','prasad','thakur','rastogi','khurana','wadhwa','ahuja','dhingra','mahajan',
  // South Indian
  'iyer','iyengar','nair','menon','pillai','reddy','rao','naidu','krishnan','raman','subramanian',
  'venkatesan','narayanan','murthy','shetty','hegde','kamath','pai','bhat','acharya','rajan','swamy',
  'chandrasekhar','balakrishnan','gopal','ramachandran','sundaram','turaga','machani',
  // Bengali / Eastern
  'chatterjee','banerjee','mukherjee','ghosh','bose','das','dutta','sen','roy','basu','chowdhury',
  'bhattacharya','sarkar','mitra','nandi','guha','kar','pal','saha','biswas','majumdar',
  // Other common Indian-origin
  'shroff','contractor','engineer','daruwala','irani','sethna','dastur','kundra','vadi','dixit','nayyar',
]

const GIVEN_NAMES = [
  'raj','rajesh','ravi','ramesh','suresh','mahesh','naresh','dinesh','mukesh','hitesh','nilesh','jignesh',
  'amit','ajay','vijay','sanjay','sunil','anil','manoj','deepak','rakesh','ashok','arun','arvind','vinod',
  'rahul','rohit','rohan','nikhil','karan','arjun','aditya','akash','ankit','abhishek','varun','vikram',
  'vivek','gaurav','harsh','kunal','siddharth','shiv','shivam','krishna','prakash','dev','yash','pranav',
  'priya','pooja','neha','anita','sunita','kavita','meera','asha','geeta','seema','rekha','usha','lata',
  'divya','ananya','aarti','shreya','sneha','riya','isha','nisha','ritu','swati','payal','tanya','simran',
  'jaspreet','harpreet','gurpreet','manpreet','amandeep','sukhdeep','navdeep','ranjit','baljit','harjit',
  'inder','jaskaran','gurdeep','satnam','balwinder','kulwinder','parminder','surinder','tejinder',
  'truna','trupti','bhavna','hetal','falguni','krupa','komal','dhruv','jay','kaushik','bhavesh','chirag',
  'kiran','sachin','sameer','rupal','minal','sonal','urvashi','avani','dhara','nikita','shilpa','hema',
]

export type OriginEstimate = {
  /** Short label for display, e.g. "Likely Indian origin" */
  label: string
  /** What matched, so the estimate is auditable */
  matched: string[]
}

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .split(/[\s'-]+/)
    .filter(Boolean)
}

/**
 * Estimate whether a full name looks Indian in origin.
 * Returns a clearly-hedged label plus the tokens that matched.
 */
export function estimateNameOrigin(fullName?: string | null): OriginEstimate {
  if (!fullName || !fullName.trim()) return { label: 'No name given', matched: [] }

  const parts = tokens(fullName)
  if (parts.length === 0) return { label: 'No name given', matched: [] }

  const surname = parts[parts.length - 1]
  const givens = parts.slice(0, -1)

  const matched: string[] = []
  const surnameHit = SURNAMES.includes(surname)
  if (surnameHit) matched.push(surname)
  const givenHits = givens.filter(g => GIVEN_NAMES.includes(g) || SURNAMES.includes(g))
  matched.push(...givenHits)

  let label: string
  if (surnameHit && givenHits.length > 0) label = 'Likely Indian origin'
  else if (surnameHit) label = 'Likely Indian origin (surname)'
  else if (givenHits.length > 0) label = 'Possibly Indian origin (first name)'
  else label = 'Not recognised'

  return { label, matched }
}

/** One-line value for the spreadsheet / email. */
export function originEstimateText(fullName?: string | null): string {
  const { label, matched } = estimateNameOrigin(fullName)
  return matched.length ? `${label} (matched: ${matched.join(', ')})` : label
}
