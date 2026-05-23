import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiPlus, FiSearch, FiPrinter, FiX, FiClipboard, FiEye, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { petsAPI, pharmacyDuesAPI, proceduresAPI, settingsAPI, procedureCatalogAPI } from '../../services/api';

const PROCEDURE_CATALOG = [
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'Dental Exam under GA (Cat/Small Breed Dog/Puppy)', unit: 'No', defaultAmount: 2000 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'Dental Exam under GA (Large Breed Dog)', unit: 'No', defaultAmount: 3000 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'G.A Cat', unit: 'No', defaultAmount: 2000 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'G.A Dog', unit: 'No', defaultAmount: 3000 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'G.A Dog (Small Breed)', unit: 'No', defaultAmount: 1500 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'G.A Kitten', unit: 'No', defaultAmount: 1000 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'G.A Puppy', unit: 'No', defaultAmount: 1500 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'G.A Bird', unit: 'ml', defaultAmount: 500 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'Ketamine', unit: 'ml', defaultAmount: 1550 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'Propofol', unit: 'ml', defaultAmount: 0 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'Xylax', unit: 'ml', defaultAmount: 50 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'Xyloaid 2% Jelly', unit: 'No', defaultAmount: 56 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'Spay/Neuter under GA (Cat)', unit: 'No', defaultAmount: 2500 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'Spay/Neuter under GA (Small Breed Dog/Puppy)', unit: 'No', defaultAmount: 3500 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'Spay/Neuter under GA (Large Breed Dog)', unit: 'No', defaultAmount: 4500 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'Dental Scaling & Polishing under GA (Cat/Small Breed Dog)', unit: 'No', defaultAmount: 3500 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'Dental Scaling & Polishing under GA (Large Breed Dog)', unit: 'No', defaultAmount: 4500 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'Minor Procedure under GA', unit: 'No', defaultAmount: 2500 },
  { mainCategory: 'Anesthesia', subCategory: 'Anesthesia', drug: 'Major Procedure under GA', unit: 'No', defaultAmount: 4500 },

  { mainCategory: 'Boarding', subCategory: 'Boarding', drug: 'Boarding (Cat)/Night with food', unit: 'No', defaultAmount: 1500 },
  { mainCategory: 'Boarding', subCategory: 'Boarding', drug: 'Boarding (Cat)/Night upto 1 Week', unit: 'Per Day', defaultAmount: 1000 },
  { mainCategory: 'Boarding', subCategory: 'Boarding', drug: 'Boarding (Cat)/Night 7-14 days', unit: 'Per Day', defaultAmount: 800 },
  { mainCategory: 'Boarding', subCategory: 'Boarding', drug: 'Boarding (Cat)/Night 14 days onward', unit: 'Per Day', defaultAmount: 600 },
  { mainCategory: 'Boarding', subCategory: 'Boarding', drug: 'Boarding (Cat)/Night without food', unit: 'No', defaultAmount: 1000 },

  { mainCategory: 'Boarding', subCategory: 'Boarding', drug: 'Boarding (Small Breed Dog)/Night upto 1 Week', unit: 'Per Day', defaultAmount: 1500 },
  { mainCategory: 'Boarding', subCategory: 'Boarding', drug: 'Boarding (Small Breed Dog)/Night 7-14 days', unit: 'Per Day', defaultAmount: 1200 },
  { mainCategory: 'Boarding', subCategory: 'Boarding', drug: 'Boarding (Small Breed Dog)/Night 14 days onward', unit: 'Per Day', defaultAmount: 900 },

  { mainCategory: 'Boarding', subCategory: 'Boarding', drug: 'Boarding (Dog)/Night with food', unit: 'No', defaultAmount: 2500 },
  { mainCategory: 'Boarding', subCategory: 'Boarding', drug: 'Boarding (Dog)/Night without food', unit: 'No', defaultAmount: 2000 },

  { mainCategory: 'Boarding', subCategory: 'Boarding', drug: 'Boarding (Large Breed Dog)/Night upto 1 Week', unit: 'Per Day', defaultAmount: 2000 },
  { mainCategory: 'Boarding', subCategory: 'Boarding', drug: 'Boarding (Large Breed Dog)/Night 7-14 days', unit: 'Per Day', defaultAmount: 1500 },
  { mainCategory: 'Boarding', subCategory: 'Boarding', drug: 'Boarding (Large Breed Dog)/Night 14 days onward', unit: 'Per Day', defaultAmount: 1000 },

  { mainCategory: 'Boarding', subCategory: 'Boarding', drug: 'Boarding (Dog Small Breed)/Night with food', unit: 'Per Day', defaultAmount: 2500 },
  { mainCategory: 'Boarding', subCategory: 'Boarding', drug: 'Boarding (Dog Large Breed)/Night with food', unit: 'Per Day', defaultAmount: 3500 },
  { mainCategory: 'Boarding', subCategory: 'Boarding', drug: 'Boarding (Critical Care Patient)/Night', unit: 'Per Day', defaultAmount: 4500 },

  { mainCategory: 'Consultation', subCategory: 'Consultation', drug: 'Consultation Fee (Cat)', unit: 'Visit', defaultAmount: 1500 },
  { mainCategory: 'Consultation', subCategory: 'Consultation', drug: 'Consultation Fee (Dog Small Breed)', unit: 'Visit', defaultAmount: 1500 },
  { mainCategory: 'Consultation', subCategory: 'Consultation', drug: 'Consultation Fee (Dog Large Breed)', unit: 'Visit', defaultAmount: 2000 },

  { mainCategory: 'Dressing', subCategory: 'Dressing', drug: 'Simple Dressing', unit: 'No', defaultAmount: 1000 },
  { mainCategory: 'Dressing', subCategory: 'Dressing', drug: 'Complex Dressing', unit: 'No', defaultAmount: 1500 },
  { mainCategory: 'Dressing', subCategory: 'Dressing', drug: 'Plaster/Supportive Bandage', unit: 'No', defaultAmount: 2000 },

  { mainCategory: 'E-Collar', subCategory: 'E-Collar', drug: 'E-Collar Small', unit: 'No', defaultAmount: 800 },
  { mainCategory: 'E-Collar', subCategory: 'E-Collar', drug: 'E-Collar Medium', unit: 'No', defaultAmount: 1000 },
  { mainCategory: 'E-Collar', subCategory: 'E-Collar', drug: 'E-Collar Large', unit: 'No', defaultAmount: 1200 },

  { mainCategory: 'Food', subCategory: 'Food', drug: 'Food Cat per day', unit: 'Per Day', defaultAmount: 500 },
  { mainCategory: 'Food', subCategory: 'Food', drug: 'Food Dog per day', unit: 'Per Day', defaultAmount: 580 },
  { mainCategory: 'Food', subCategory: 'Food', drug: 'Food Dog Small Breed per day', unit: 'Per Day', defaultAmount: 700 },
  { mainCategory: 'Food', subCategory: 'Food', drug: 'Food Dog Large Breed per day', unit: 'Per Day', defaultAmount: 900 },

  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Bathing (Cat)', unit: 'No', defaultAmount: 3000 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Bathing (Kitten)', unit: 'No', defaultAmount: 1500 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Bathing (Large Breed Dog)', unit: 'No', defaultAmount: 5000 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Bathing (Small Breed Dog)', unit: 'No', defaultAmount: 3000 },

  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Beak Triming (Bird)', unit: 'No', defaultAmount: 350 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Nails Triming (Bird)', unit: 'No', defaultAmount: 300 },

  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Demating/ Compacted Fur (Cat/Small Breed Dog)', unit: 'No', defaultAmount: 4000 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Demating/ Compacted Fur (Large Breed Dog)', unit: 'No', defaultAmount: 6000 },

  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Ear Cleaning (Cat/Small Breed Dog/Puppy)', unit: 'No', defaultAmount: 300 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Eye Cleaning (Cat/Small Breed Dog/Puppy)', unit: 'No', defaultAmount: 300 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Medicated Ear Cleaning (Cat/Small Breed Dog/Puppy)', unit: 'No', defaultAmount: 500 },

  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Ear Cleaning (Large Breed Dog)', unit: 'No', defaultAmount: 600 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Medicated Ear Cleaning (Large Breed Dog)', unit: 'No', defaultAmount: 1000 },

  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Combing (Cat/Small Breed Dog/Puppy)', unit: 'No', defaultAmount: 500 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Combing (Large Breed Dog)', unit: 'No', defaultAmount: 1000 },

  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Hair Triming Good Condition Coat (Cat/Small Breed Dog/Puppy)', unit: 'No', defaultAmount: 3000 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Hair Triming Good Condition Coat (Large Breed Dog)', unit: 'No', defaultAmount: 5000 },

  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Hair Triming (Cat)', unit: 'No', defaultAmount: 3000 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Tangles and Small Matts removal (Cat/Small Breed Dog/Puppy)', unit: 'No', defaultAmount: 500 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Hair Triming (Large Breed Dog)', unit: 'No', defaultAmount: 5000 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Tangles and Small Matts removal (Large Breed Dog)', unit: 'No', defaultAmount: 1500 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Minor Grooming (Parineal Hair + Paws)', unit: 'No', defaultAmount: 500 },

  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Nail Triming (Cat/Small Breed Dog/Puppy)', unit: 'No', defaultAmount: 350 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Medium Size Matts Removal (Cat/Small Breed Dog/Puppy)', unit: 'No', defaultAmount: 1500 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Nail Triming (Large Breed Dog)', unit: 'No', defaultAmount: 800 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Medium Size Matts Removal (Large Breed Dog)', unit: 'No', defaultAmount: 2500 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Nail Triming (Rabbit)', unit: 'No', defaultAmount: 300 },

  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Tooth Brush (Cat)', unit: 'No', defaultAmount: 1200 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Tooth Brush (Kitten)', unit: 'No', defaultAmount: 500 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Tooth Brush (Large Breed Dog)', unit: 'No', defaultAmount: 1500 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Tooth Brush (Small Breed Dog)', unit: 'No', defaultAmount: 1200 },

  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Full Grooming (Cat)', unit: 'No', defaultAmount: 5000 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Full Grooming (Small Breed Dog)', unit: 'No', defaultAmount: 6000 },
  { mainCategory: 'Grooming', subCategory: 'Grooming', drug: 'Full Grooming (Large Breed Dog)', unit: 'No', defaultAmount: 7000 },

  { mainCategory: 'House Call', subCategory: 'House Call', drug: 'Consultation (Kennel Farm with visit)', unit: 'No', defaultAmount: 10000 },
  { mainCategory: 'House Call', subCategory: 'House Call', drug: "Technician's home visit", unit: 'No', defaultAmount: 1000 },
  { mainCategory: 'House Call', subCategory: 'House Call', drug: "Doctor's home visit within ATD", unit: 'No', defaultAmount: 5000 },
  { mainCategory: 'House Call', subCategory: 'House Call', drug: "Doctor's home visit within ATD (Horse)", unit: 'No', defaultAmount: 8000 },

  { mainCategory: 'Hospital Care', subCategory: 'Hospital Care', drug: 'Day Care (Cat)', unit: 'Per Day', defaultAmount: 2000 },
  { mainCategory: 'Hospital Care', subCategory: 'Hospital Care', drug: 'Day Care (Dog Small Breed)', unit: 'Per Day', defaultAmount: 2500 },
  { mainCategory: 'Hospital Care', subCategory: 'Hospital Care', drug: 'Day Care (Dog Large Breed)', unit: 'Per Day', defaultAmount: 3000 },

  { mainCategory: 'Injection', subCategory: 'Injection', drug: 'Injection IM/SC (Cat/Small Breed)', unit: 'No', defaultAmount: 500 },
  { mainCategory: 'Injection', subCategory: 'Injection', drug: 'Injection IM/SC (Large Breed Dog)', unit: 'No', defaultAmount: 700 },
  { mainCategory: 'Injection', subCategory: 'Injection', drug: 'IV Cannula Placement', unit: 'No', defaultAmount: 1000 },
  { mainCategory: 'Injection', subCategory: 'Injection', drug: 'IV Fluid Therapy (per bottle)', unit: 'Bottle', defaultAmount: 1500 },

  { mainCategory: 'Lab Test', subCategory: 'Lab Test', drug: 'CBC', unit: 'No', defaultAmount: 1500 },
  { mainCategory: 'Lab Test', subCategory: 'Lab Test', drug: 'LFT', unit: 'No', defaultAmount: 2000 },
  { mainCategory: 'Lab Test', subCategory: 'Lab Test', drug: 'KFT', unit: 'No', defaultAmount: 2000 },
  { mainCategory: 'Lab Test', subCategory: 'Lab Test', drug: 'Urinalysis Complete', unit: 'No', defaultAmount: 1500 },
  { mainCategory: 'Lab Test', subCategory: 'Lab Test', drug: 'Fecal Examination', unit: 'No', defaultAmount: 1000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Abscess Drainage (Cat)', unit: 'No', defaultAmount: 1000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Abscess Drainage under G.A (Cat)', unit: 'No', defaultAmount: 3500 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Abscess Drainage (Dog)', unit: 'No', defaultAmount: 2000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Abscess Drainage under G.A (Dog)', unit: 'No', defaultAmount: 5500 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Abdominocentesis (Cat) US Guided', unit: 'No', defaultAmount: 1000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Abdominocentesis (Dog) US Guided', unit: 'No', defaultAmount: 1500 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Acquired Cleft Palate Reconstruction', unit: 'No', defaultAmount: 12000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Administration of IM Injection', unit: 'No', defaultAmount: 50 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Administration of IV Injection', unit: 'No', defaultAmount: 100 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Administration of Tablet', unit: 'No', defaultAmount: 100 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Administration of Infusion', unit: 'No', defaultAmount: 500 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Placement of IV Cannula', unit: 'No', defaultAmount: 500 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Anal Gland Drainage (Cat)', unit: 'No', defaultAmount: 500 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Anal Gland Drainage (Dog)', unit: 'No', defaultAmount: 1000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Anti-Parasite Spray', unit: 'No', defaultAmount: 500 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Aural Hematoma', unit: 'No', defaultAmount: 12000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Bilateral Entropion', unit: 'No', defaultAmount: 15000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Blood Transfusion (Cat)', unit: 'No', defaultAmount: 3000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Blood Transfusion (Dog)', unit: 'No', defaultAmount: 3000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Bird Necropsy', unit: 'No', defaultAmount: 300 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Bird Post Martem', unit: 'No', defaultAmount: 500 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Cesarean Section (Dog)', unit: 'No', defaultAmount: 39000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Cesarean Section (Queen)', unit: 'No', defaultAmount: 25000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Cyst Drainage', unit: 'No', defaultAmount: 500 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Cystotomy', unit: 'No', defaultAmount: 35000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Foreign Body Removal (GIT)', unit: 'No', defaultAmount: 40000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Dental Imaging (Cat/Small Breed Dog/Puppy)', unit: 'No', defaultAmount: 3000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Dental Imaging (Large Breed Dog)', unit: 'No', defaultAmount: 4000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Dewclaw Amputation (Surgery) Puppy', unit: 'No', defaultAmount: 8000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Dewclaw Amputation (Surgery) Adult', unit: 'No', defaultAmount: 12000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Ear Tapping (Dog)', unit: 'No', defaultAmount: 1000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Endoscopy (Dog)', unit: 'No', defaultAmount: 5000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Endoscopy (Queen)', unit: 'No', defaultAmount: 3000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Entropion Unilateral (Dog)', unit: 'No', defaultAmount: 7500 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Emucleation', unit: 'No', defaultAmount: 10000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Euthanasia Cat', unit: 'No', defaultAmount: 1500 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Euthanasia Dog', unit: 'No', defaultAmount: 2000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Euthanasia Kitten', unit: 'No', defaultAmount: 1000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Euthanasia Puppy', unit: 'No', defaultAmount: 1500 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Examination under G.A', unit: 'No', defaultAmount: 2000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Explorative Laparotomy', unit: 'No', defaultAmount: 40000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Feeding Tube', unit: 'No', defaultAmount: 1000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'FHO (Unilateral)', unit: 'No', defaultAmount: 50000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Fracture Repair (Simple)', unit: 'No', defaultAmount: 45000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Fracture Repair (Complex)', unit: 'No', defaultAmount: 65000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'General Examination/ Procedure', unit: 'No', defaultAmount: 1000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Lump Removal (Small)', unit: 'No', defaultAmount: 15000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Lump Removal (Large)', unit: 'No', defaultAmount: 25000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Ear Hematoma Surgery', unit: 'No', defaultAmount: 25000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Entropion/Ectropion Correction', unit: 'No', defaultAmount: 25000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Tail Docking (Puppy)', unit: 'No', defaultAmount: 8000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Dewclaw Removal', unit: 'No', defaultAmount: 8000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Pyometra Surgery', unit: 'No', defaultAmount: 40000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Orthopedic Consultation and Planning', unit: 'No', defaultAmount: 5000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Endoscopy (Diagnostic)', unit: 'No', defaultAmount: 25000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Gastric Levage (Cat/Small Breed Dog/Puppy)', unit: 'No', defaultAmount: 3000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Gastropexy', unit: 'No', defaultAmount: 30000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Herniaplasty', unit: 'No', defaultAmount: 20000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Inguinoplasty (Coup Reconstruction)', unit: 'No', defaultAmount: 7000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Leg Amputation Large Bird', unit: 'No', defaultAmount: 5000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Limb Amputation Cat', unit: 'No', defaultAmount: 25000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Limb Amputation Dog', unit: 'No', defaultAmount: 35000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Lime-Sulfur Dip', unit: 'No', defaultAmount: 1000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Maggot Extraction Stage 1', unit: 'No', defaultAmount: 4000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Maggot Extraction Stage 2', unit: 'No', defaultAmount: 6000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Maggot Extraction Stage 3', unit: 'No', defaultAmount: 8000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Maggot Extraction Stage 4', unit: 'No', defaultAmount: 10000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Microchip Implantation & scanning', unit: 'No', defaultAmount: 500 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Microchip Implantation (including Microchip)', unit: 'No', defaultAmount: 3000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Microchip Scanning', unit: 'No', defaultAmount: 500 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Induction of Parturition', unit: 'No', defaultAmount: 3000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Nasogastric tube', unit: 'No', defaultAmount: 500 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Nebulize', unit: 'No', defaultAmount: 500 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Onychectomy (Cat)', unit: 'No', defaultAmount: 7500 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Onychectomy (Dog)', unit: 'No', defaultAmount: 15000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Oral Tumor Extraction (Cat)', unit: 'No', defaultAmount: 7000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Oral Tumor Extraction (Dog)', unit: 'No', defaultAmount: 10000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Orchiectomy (Cat/Small Breed Dog)', unit: 'No', defaultAmount: 10000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Orchiectomy (Large Breed Dog)', unit: 'No', defaultAmount: 15000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Ovariohysterectomy (Cat/Small Breed Dog)', unit: 'No', defaultAmount: 25000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Ovariohysterectomy (Queen/Small Breed Dog)', unit: 'No', defaultAmount: 20000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Ovariohysterectomy Pyometra (Queen/Small Breed Dog)', unit: 'No', defaultAmount: 25000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Cesarian / C-Section (Cat/Small Breed Dog)', unit: 'No', defaultAmount: 30000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Cesarian / C-Section (Large Breed Dog)', unit: 'No', defaultAmount: 35000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Parenteral Administration of Drugs', unit: 'No', defaultAmount: 150 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Parineal Hemoplasty', unit: 'No', defaultAmount: 25000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Stitch Removal Cat', unit: 'No', defaultAmount: 1000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Scaling (Cat/Small Breed Dog)', unit: 'No', defaultAmount: 5000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Dental Scaling (Dog)', unit: 'No', defaultAmount: 7000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Scaling (Large Breed Dog)', unit: 'No', defaultAmount: 7000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Surgical Gluing', unit: 'No', defaultAmount: 1000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Reduction of Rectum Prolapse', unit: 'No', defaultAmount: 2000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Tail Docking (Cat)', unit: 'No', defaultAmount: 10000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Tail Docking (Dog)', unit: 'No', defaultAmount: 15000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Tooth Extraction per Tooth (Excluding GA) (Cat/Small Breed Dog)', unit: 'No', defaultAmount: 500 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Tooth Extraction per Tooth (Excluding GA) (Large Breed Dog)', unit: 'No', defaultAmount: 700 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Tooth Extraction Full Mouth (Excluding GA & Canine teeth) (Cat/Small Breed Dog)', unit: 'No', defaultAmount: 10000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Tooth Extraction Full Mouth (Excluding GA & Canine teeth) (Large Breed Dog)', unit: 'No', defaultAmount: 15000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Tumor Extraction (Cat)', unit: 'No', defaultAmount: 5000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Tumor Extraction (Dog)', unit: 'No', defaultAmount: 15000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Tumor Extraction (Mammary Gland) Cat', unit: 'No', defaultAmount: 25000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Tumor Extraction (Mammary Gland) Dog', unit: 'No', defaultAmount: 30000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'TVT Surgery', unit: 'No', defaultAmount: 20000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Unilateral Entropion', unit: 'No', defaultAmount: 7000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Urinary Catheterization (Cat)', unit: 'No', defaultAmount: 5000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Urinary Catheterization (Dog)', unit: 'No', defaultAmount: 6000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Vaginal Prolapse Reduction', unit: 'No', defaultAmount: 2500 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Vaginopexy', unit: 'No', defaultAmount: 10000 },

  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Wound Cleaning & ASD', unit: 'No', defaultAmount: 450 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Wound Reconstruction Surgery', unit: 'No', defaultAmount: 2000 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Minor Wound Reconstruction (Dog)', unit: 'No', defaultAmount: 500 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Wound Reconstruction Bird', unit: 'No', defaultAmount: 500 },
  { mainCategory: 'Procedure', subCategory: 'Procedure', drug: 'Wound Reconstruction Horse', unit: 'No', defaultAmount: 5000 },

  { mainCategory: 'Procedure_Fee', subCategory: 'Procedure_Fee', drug: 'Dog Cesarean Section', unit: 'No', defaultAmount: 14500 },
  { mainCategory: 'Procedure_Fee', subCategory: 'Procedure_Fee', drug: 'Cat Cesarean Section', unit: 'No', defaultAmount: 12500 },
  { mainCategory: 'Procedure_Fee', subCategory: 'Procedure_Fee', drug: 'Fracture Repair Fee (Simple)', unit: 'No', defaultAmount: 20000 },
  { mainCategory: 'Procedure_Fee', subCategory: 'Procedure_Fee', drug: 'Fracture Repair Fee (Complex)', unit: 'No', defaultAmount: 30000 },
  { mainCategory: 'Procedure_Fee', subCategory: 'Procedure_Fee', drug: 'Lump Removal Fee (Small)', unit: 'No', defaultAmount: 8000 },
  { mainCategory: 'Procedure_Fee', subCategory: 'Procedure_Fee', drug: 'Lump Removal Fee (Large)', unit: 'No', defaultAmount: 12000 },
  { mainCategory: 'Procedure_Fee', subCategory: 'Procedure_Fee', drug: 'Dog Ovariohysterectomy', unit: 'No', defaultAmount: 11500 },
  { mainCategory: 'Procedure_Fee', subCategory: 'Procedure_Fee', drug: 'Goat Cesarean Section', unit: 'No', defaultAmount: 8000 },
  { mainCategory: 'Procedure_Fee', subCategory: 'Procedure_Fee', drug: 'Ear Cropping', unit: 'No', defaultAmount: 5500 },
  { mainCategory: 'Procedure_Fee', subCategory: 'Procedure_Fee', drug: 'Dog Orchiectomy', unit: 'No', defaultAmount: 8000 },
  { mainCategory: 'Procedure_Fee', subCategory: 'Procedure_Fee', drug: 'Dog Gastropexy', unit: 'No', defaultAmount: 16500 },
  { mainCategory: 'Procedure_Fee', subCategory: 'Procedure_Fee', drug: 'Queen Ovariohysterectomy', unit: 'No', defaultAmount: 8500 },
  { mainCategory: 'Procedure_Fee', subCategory: 'Procedure_Fee', drug: 'Cat Orchiectomy', unit: 'No', defaultAmount: 6500 },

  { mainCategory: 'Radiology', subCategory: 'Radiology', drug: 'X-Ray Single View', unit: 'No', defaultAmount: 2500 },
  { mainCategory: 'Radiology', subCategory: 'Radiology', drug: 'X-Ray Two Views', unit: 'No', defaultAmount: 3500 },
  { mainCategory: 'Radiology', subCategory: 'Radiology', drug: 'Ultrasound Single Region', unit: 'No', defaultAmount: 3500 },
  { mainCategory: 'Radiology', subCategory: 'Radiology', drug: 'Ultrasound Complete Abdomen', unit: 'No', defaultAmount: 5000 },
  { mainCategory: 'Radiology', subCategory: 'Radiology', drug: 'Echocardiography', unit: 'No', defaultAmount: 8000 },
];

const unique = (arr) => Array.from(new Set(arr.filter(Boolean)));

export default function ReceptionProcedures() {
  const [pets, setPets] = useState([]);
  const [petId, setPetId] = useState('');
  const [petDetails, setPetDetails] = useState({ petName: '', ownerName: '', contact: '', clientId: '' });
  const [rows, setRows] = useState([
    { mainCategory: '', subCategory: '', drug: '', quantity: 1, unit: '', amount: 0 },
  ]);
  const [catalog, setCatalog] = useState(PROCEDURE_CATALOG);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [newItem, setNewItem] = useState({ mainCategory: '', subCategory: '', drug: '', unit: '', defaultAmount: 0, defaultQuantity: 1 });
  const [manageCatalogOpen, setManageCatalogOpen] = useState(false);
  const [manageCatalogItems, setManageCatalogItems] = useState([]);
  const [manageCatalogDeletedIds, setManageCatalogDeletedIds] = useState([]);
  const [manageCatalogNew, setManageCatalogNew] = useState({ mainCategory: '', subCategory: '', drug: '', unit: '', defaultAmount: 0, defaultQuantity: 1 });
  const [manageCatalogError, setManageCatalogError] = useState('');
  const [manageCatalogSaving, setManageCatalogSaving] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState(null);
  const [previousDues, setPreviousDues] = useState(0);
  const [subtotal, setSubtotal] = useState(0);
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState('PKR');
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [saving, setSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [toast, setToast] = useState('');
  const printRef = useRef(null);
  const [hospitalSettings, setHospitalSettings] = useState(null);
  const [records, setRecords] = useState([]);
  const todayStr = () => new Date().toISOString().slice(0,10);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [creatingItem, setCreatingItem] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3500);
  };

  useEffect(() => {
    const loadPets = async () => {
      try {
        const res = await petsAPI.getAll();
        setPets(res.data || []);
      } catch {
        setPets([]);
      }
    };
    loadPets();
  }, []);

  // Load existing procedure records from backend
  useEffect(() => {
    refreshRecords();
  }, []);

  const refreshRecords = async () => {
    try {
      const res = await proceduresAPI.getAll('?includeImported=true');
      const arr = res.data || [];
      const normalized = arr.map(r => {
        const gt = Number(r.grandTotal ?? 0);
        const recv = (r.receivedAmount != null)
          ? Number(r.receivedAmount)
          : (r.receivable != null ? Math.max(0, gt - Number(r.receivable)) : 0);
        const due = (r.receivable != null)
          ? Number(r.receivable)
          : Math.max(0, gt - recv);
        return { ...r, receivedAmount: recv, receivable: due };
      });
      setRecords(normalized);
    } catch (err) {
      setRecords([]);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const res = await settingsAPI.get(user.username || 'admin');
        setHospitalSettings(res.data || res);
      } catch {}
    };
    fetchSettings();
  }, []);

  // Load procedure catalog from backend; if empty, seed from built-in list once
  useEffect(() => {
    let isMounted = true;
    const initCatalog = async () => {
      try {
        const res = await procedureCatalogAPI.getAll();
        if (!isMounted) return;
        const dbItems = (res?.data && Array.isArray(res.data)) ? res.data : [];
        
        if (dbItems.length === 0) {
          try {
            // Use a clean version of the catalog for seeding
            const seedData = PROCEDURE_CATALOG.map(item => ({
              mainCategory: item.mainCategory,
              subCategory: item.subCategory,
              drug: item.drug,
              unit: item.unit || 'No',
              defaultAmount: item.defaultAmount || 0,
              defaultQuantity: 1
            }));
            await procedureCatalogAPI.bulkUpsert(seedData);
            const res2 = await procedureCatalogAPI.getAll();
            if (isMounted) setCatalog(res2?.data || []);
          } catch (seedErr) {
            console.error('Seeding failed:', seedErr);
            if (isMounted) setCatalog(PROCEDURE_CATALOG);
          }
        } else {
          if (isMounted) setCatalog(dbItems);
        }
      } catch (e) {
        if (isMounted) setCatalog(PROCEDURE_CATALOG);
      }
    };
    initCatalog();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const total = rows.reduce((sum, r) => sum + (Number(r.amount || 0) * Number(r.quantity || 0)), 0);
    setSubtotal(total);
  }, [rows]);

  useEffect(() => {
    const fetchDues = async () => {
      if (!petDetails.clientId) {
        setPreviousDues(0);
        setReceivedAmount(0);
        return;
      }
      try {
        // Calculate previous dues only from procedure records (not consultation/registration)
        const procsRes = await proceduresAPI.getAll(`?clientId=${encodeURIComponent(petDetails.clientId)}&includeImported=true`);
        const clientProcs = procsRes?.data || [];
        const procedureDues = clientProcs.reduce((sum, rec) => {
          const gt = Number(rec.grandTotal ?? (Number(rec.subtotal || 0) + Number(rec.previousDues || 0)));
          const recv = Number(rec.receivedAmount ?? 0);
          const receivable = Number(rec.receivable ?? Math.max(0, gt - recv));
          return sum + receivable;
        }, 0);
        setPreviousDues(procedureDues);
      } catch {
        setPreviousDues(0);
      }
    };
    fetchDues();
  }, [petDetails.clientId]);

  useEffect(() => {
    if (showDialog) {
      setPetDetails(prev => ({
        ...prev,
        clientId: prev.clientId || `CLI-${Date.now()}`,
      }));
      if (!petId) {
        const today = new Date();
        const year = today.getFullYear().toString().slice(-2);
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        setPetId(`${year}${month}${day}${random}`);
      }
    }
  }, [showDialog]);

  const handlePetIdChange = async (value) => {
    setPetId(value);
    // 1) Try Pet registry first
    let pet = pets.find((p) => String(p.id) === String(value) || String(p.patientId) === String(value));
    let next = null;
    if (pet) {
      const clientId = pet.clientId || pet.details?.owner?.clientId || '';
      next = {
        petName: pet.petName || '',
        ownerName: pet.ownerName || pet.details?.owner?.fullName || '',
        contact: pet.ownerContact || pet.details?.owner?.contact || '',
        clientId,
      };
    }

    // 2) Also try last saved Procedure record for this pet to recover clientId/owner details
    try {
      const res = await proceduresAPI.getAll(`?petId=${encodeURIComponent(value)}`);
      const last = (res?.data || [])[0];
      if (last) {
        next = {
          petName: (next?.petName || last.petName || ''),
          ownerName: (next?.ownerName || last.ownerName || ''),
          contact: (next?.contact || last.contact || ''),
          clientId: (next?.clientId || last.clientId || ''),
        };
      }
    } catch {}

    // 3) If we still don't have a clientId but we have contact, use contact as dues key (matches how dues were stored when clientId was missing)
    if (next && !next.clientId && next.contact) {
      next.clientId = next.contact;
    }

    if (next) setPetDetails(next);
  };

  const handlePetFieldChange = (field, value) => {
    setPetDetails((prev) => ({ ...prev, [field]: value }));
  };

  const ensureIds = () => {
    let finalPetId = petId;
    let finalClientId = petDetails.clientId;
    if (!finalPetId) {
      finalPetId = `PET-${Date.now()}`;
    }
    if (!finalClientId) {
      finalClientId = `CLI-${Date.now()}`;
    }
    return { finalPetId, finalClientId };
  };

  const mainCategories = useMemo(() => unique(catalog.map((r) => r.mainCategory)), [catalog]);
  const subCategories = useMemo(
    () => unique(catalog.filter((r) => !rows[0].mainCategory || r.mainCategory === rows[0].mainCategory).map((r) => r.subCategory)),
    [rows, catalog]
  );

  const sanitizeRowsWithCatalog = (cat) => {
    try {
      setRows(prev => prev.map(r => {
        const mc = String(r.mainCategory || '').trim();
        const sc = String(r.subCategory || '').trim();
        const dr = String(r.drug || '').trim();
        if (!mc) return r
        const hasMain = (cat || []).some(i => String(i.mainCategory || '').trim() === mc)
        if (!hasMain) return { ...r, mainCategory: '', subCategory: '', drug: '', unit: '', amount: 0 }
        if (sc) {
          const hasSub = (cat || []).some(i => String(i.mainCategory || '').trim() === mc && String(i.subCategory || '').trim() === sc)
          if (!hasSub) return { ...r, subCategory: '', drug: '', unit: '', amount: 0 }
        }
        if (sc && dr) {
          const match = (cat || []).find(i => String(i.mainCategory || '').trim() === mc && String(i.subCategory || '').trim() === sc && String(i.drug || '').trim() === dr)
          if (!match) return { ...r, drug: '', unit: '', amount: 0 }
        }
        return r
      }))
    } catch {}
  }

  const openManageCatalog = () => {
    setManageCatalogItems((catalog || []).map(it => ({
      _id: it._id,
      mainCategory: it.mainCategory || '',
      subCategory: it.subCategory || '',
      drug: it.drug || '',
      unit: it.unit || '',
      defaultAmount: Number(it.defaultAmount ?? it.amount ?? 0),
      defaultQuantity: Number(it.defaultQuantity ?? 1),
    })))
    setManageCatalogDeletedIds([])
    setManageCatalogNew({ mainCategory: '', subCategory: '', drug: '', unit: '', defaultAmount: 0, defaultQuantity: 1 })
    setManageCatalogError('')
    setManageCatalogOpen(true)
  }

  const closeManageCatalog = () => {
    setManageCatalogOpen(false)
    setManageCatalogError('')
  }

  const setManageCatalogField = (idx, field, value) => {
    setManageCatalogItems(prev => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }

  const removeManageCatalogItem = (idx) => {
    setManageCatalogItems(prev => {
      const it = prev[idx]
      if (it?._id) setManageCatalogDeletedIds(ids => Array.from(new Set([...(ids || []), it._id])))
      return prev.filter((_, i) => i !== idx)
    })
  }

  const addManageCatalogItem = () => {
    const payload = {
      _id: '',
      mainCategory: String(manageCatalogNew.mainCategory || '').trim(),
      subCategory: String(manageCatalogNew.subCategory || '').trim(),
      drug: String(manageCatalogNew.drug || '').trim(),
      unit: String(manageCatalogNew.unit || '').trim(),
      defaultAmount: Number(manageCatalogNew.defaultAmount || 0),
      defaultQuantity: Math.max(1, Number(manageCatalogNew.defaultQuantity || 1)),
    }
    if (!payload.mainCategory || !payload.subCategory || !payload.drug) {
      setManageCatalogError('Main Category, Sub Category, and Drug are required.')
      return
    }
    setManageCatalogItems(prev => [...prev, payload])
    setManageCatalogNew({ mainCategory: '', subCategory: '', drug: '', unit: '', defaultAmount: 0, defaultQuantity: 1 })
    setManageCatalogError('')
  }

  const saveManageCatalog = async () => {
    const cleaned = (manageCatalogItems || [])
      .map(it => ({
        ...it,
        mainCategory: String(it.mainCategory || '').trim(),
        subCategory: String(it.subCategory || '').trim(),
        drug: String(it.drug || '').trim(),
        unit: String(it.unit || '').trim(),
        defaultAmount: Number(it.defaultAmount || 0),
        defaultQuantity: Math.max(1, Number(it.defaultQuantity || 1)),
      }))
      .filter(it => it.mainCategory && it.subCategory && it.drug)

    const seen = new Set()
    for (const it of cleaned) {
      const k = `${it.mainCategory}||${it.subCategory}||${it.drug}`.toLowerCase()
      if (seen.has(k)) {
        setManageCatalogError('Duplicate items found (same Main/Sub/Drug).')
        return
      }
      seen.add(k)
    }

    try {
      setManageCatalogSaving(true)
      setManageCatalogError('')

      await Promise.all((manageCatalogDeletedIds || []).map(async (id) => {
        try { await procedureCatalogAPI.delete(id) } catch {}
      }))

      await Promise.all(cleaned.map(async (it) => {
        const payload = {
          mainCategory: it.mainCategory,
          subCategory: it.subCategory,
          drug: it.drug,
          unit: it.unit,
          defaultAmount: it.defaultAmount,
          defaultQuantity: it.defaultQuantity,
        }
        try {
          if (it._id) return await procedureCatalogAPI.update(it._id, payload)
          return await procedureCatalogAPI.create(payload)
        } catch {}
      }))

      const res = await procedureCatalogAPI.getAll();
      const next = (res?.data && Array.isArray(res.data)) ? res.data : []
      setCatalog(next)
      sanitizeRowsWithCatalog(next)
      closeManageCatalog()
    } catch (e) {
      setManageCatalogError(e?.response?.message || e?.message || 'Failed to save catalog')
    } finally {
      setManageCatalogSaving(false)
    }
  }

  const updateRow = (index, changes) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[index], ...changes };

      if ('mainCategory' in changes) {
        if (!('subCategory' in changes)) row.subCategory = '';
        if (!('drug' in changes)) row.drug = '';
        row.unit = '';
        row.amount = 0;
      }
      if ('subCategory' in changes) {
        if (!('drug' in changes)) row.drug = '';
        row.unit = '';
        row.amount = 0;
      }
      if ('drug' in changes) {
        const match = catalog.find(
          (r) => r.mainCategory === row.mainCategory && r.subCategory === row.subCategory && r.drug === row.drug
        );
        if (match) {
          row.unit = match.unit || row.unit;
          row.amount = (match.defaultAmount ?? match.amount ?? row.amount);
          row.quantity = Number(row.quantity || match.defaultQuantity || 1);
        }
      }
      next[index] = row;
      return next;
    });
  };

  const openNewItem = (index) => {
    setActiveRowIndex(index);
    const base = rows[index] || {};
    setNewItem({
      mainCategory: base.mainCategory || '',
      subCategory: base.subCategory || '',
      drug: '',
      unit: base.unit || '',
      defaultAmount: 0,
      defaultQuantity: 1,
    });
    setShowNewItemModal(true);
  };

  const saveNewItem = async () => {
    const payload = {
      mainCategory: String(newItem.mainCategory || '').trim(),
      subCategory: String(newItem.subCategory || '').trim(),
      drug: String(newItem.drug || '').trim(),
      unit: String(newItem.unit || '').trim(),
      defaultAmount: Number(newItem.defaultAmount || 0),
      defaultQuantity: Number(newItem.defaultQuantity || 1),
    };
    if (!payload.mainCategory || !payload.subCategory || !payload.drug) return;
    try {
      setCreatingItem(true);
      const res = await procedureCatalogAPI.create(payload);
      const created = res?.data || payload;
      setCatalog((prev) => {
        const exists = prev.some(p => p.mainCategory===payload.mainCategory && p.subCategory===payload.subCategory && p.drug===payload.drug);
        return exists ? prev : [...prev, created];
      });
      if (activeRowIndex !== null && activeRowIndex !== undefined) {
        updateRow(activeRowIndex, { mainCategory: payload.mainCategory, subCategory: payload.subCategory, drug: payload.drug });
      }
      setShowNewItemModal(false);
    } catch (e) {
      try { alert(e?.response?.message || e?.message || 'Failed to save'); } catch {}
    } finally {
      setCreatingItem(false);
    }
  };

  const addRow = () => {
    setRows((prev) => [...prev, { mainCategory: '', subCategory: '', drug: '', quantity: 1, unit: '', amount: 0 }]);
  };

  const removeRow = (index) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleEdit = (record) => {
    setEditingRecordId(record._id);
    setPetId(record.petId || '');
    setPetDetails({
      petName: record.petName || '',
      ownerName: record.ownerName || '',
      contact: record.contact || '',
      clientId: record.clientId || '',
    });
    setRows((record.procedures || []).map(p => ({
      mainCategory: p.mainCategory || '',
      subCategory: p.subCategory || '',
      drug: p.drug || '',
      quantity: Number(p.quantity || 1),
      unit: p.unit || '',
      amount: Number(p.amount || 0),
    })));
    setPreviousDues(Number(record.previousDues || 0));
    setReceivedAmount(Number(record.receivedAmount || 0));
    setShowDialog(true);
  };

  const handleDelete = (record) => {
    setRecordToDelete(record);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await proceduresAPI.delete(recordToDelete._id);
      setRecords(prev => prev.filter(r => r._id !== recordToDelete._id));
      setShowDeleteConfirm(false);
      setRecordToDelete(null);
    } catch (e) {
      alert(e?.response?.message || e?.message || 'Failed to delete record');
    }
  };

  const handleSubmit = async (printAfter) => {
    if (!petDetails.petName || !petDetails.ownerName) {
      alert('Please enter Pet Name and Owner Name');
      return;
    }
    const cleanRows = rows.filter((r) => r.mainCategory && r.subCategory && r.drug && r.quantity > 0);
    if (cleanRows.length === 0) {
      alert('Please add at least one procedure row');
      return;
    }

    const { finalPetId, finalClientId } = ensureIds();
    const paid = Math.max(0, Number(receivedAmount || 0));
    const receivableNow = Math.max(0, grandTotal - paid);
    const payload = {
      petId: finalPetId,
      clientId: finalClientId,
      petName: petDetails.petName,
      ownerName: petDetails.ownerName,
      contact: petDetails.contact,
      procedures: cleanRows.map((r) => ({
        mainCategory: r.mainCategory,
        subCategory: r.subCategory,
        drug: r.drug,
        quantity: Number(r.quantity || 0),
        unit: r.unit,
        amount: Number(r.amount || 0),
      })),
      subtotal,
      discount: discountAmount,
      discountType,
      discountValue: Number(discountValue || 0),
      previousDues,
      grandTotal,
      receivedAmount: paid,
      receivable: receivableNow,
      paymentMethod,
    };

    try {
      setSaving(true);
      let saved;
      if (editingRecordId) {
        const res = await proceduresAPI.update(editingRecordId, payload);
        saved = { ...payload, ...(res?.data || {}) };
        setRecords(prev => prev.map(r => r._id === editingRecordId ? { ...saved, _id: editingRecordId } : r));
      } else {
        const res = await proceduresAPI.create(payload);
        saved = { ...payload, ...(res?.data || {}) };
        setRecords(prev => [{
          _id: saved._id || `${Date.now()}`,
          createdAt: saved.createdAt || new Date().toISOString(),
          ...saved,
        }, ...prev]);
        showToast('Procedure saved! Session-1 will appear in Procedure Patient Details.');
      }
      try {
        const id = finalClientId || petDetails.contact || 'unknown';
        await pharmacyDuesAPI.upsert(id, {
          previousDue: receivableNow,
          name: petDetails.ownerName,
          customerContact: petDetails.contact,
        });
      } catch (e) {
        console.error('Error updating pharmacy dues for procedures', e);
      }
      setShowDialog(false);
      setEditingRecordId(null);
      setReceiptData(saved);
      setShowReceiptModal(true);
      try { await refreshRecords(); } catch {}
      try { localStorage.setItem('financial_updated_at', String(Date.now())); window.dispatchEvent(new Event('financial-updated')) } catch {}
      if (printAfter) {
        setTimeout(() => {
          try {
            printThermalReceipt({ ...saved });
          } catch {}
        }, 200);
      }
    } catch (e) {
      console.error('Error saving procedure:', e);
      alert(e?.response?.data?.message || e?.message || 'Failed to save procedure. Ensure the portal day is open.');
    } finally {
      setSaving(false);
    }
  };

  const discountAmount = useMemo(() => {
    if (discountType === '%') {
      return (subtotal * Number(discountValue || 0)) / 100;
    }
    return Number(discountValue || 0);
  }, [subtotal, discountValue, discountType]);

  const grandTotal = Math.max(0, subtotal - discountAmount) + previousDues;
  const receivable = Math.max(0, grandTotal - Number(receivedAmount || 0));

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const rawDate = r.createdAt || r.date || new Date().toISOString();
      const recordDateStr = rawDate.slice(0, 10); // "YYYY-MM-DD"
      
      if (dateFrom && recordDateStr < dateFrom) return false;
      if (dateTo && recordDateStr > dateTo) return false;
      return true;
    });
  }, [records, dateFrom, dateTo]);

  const buildReceiptHTML = (data) => {
    const name = (hospitalSettings?.hospitalName || hospitalSettings?.companyName || 'Abbottabad Pet Hospital');
    const addr = (hospitalSettings?.address || 'Main Boulevard, Gulshan-e-Iqbal, Karachi');
    const phone = (hospitalSettings?.phone || '+92-21-1234567');

    const itemsHTML = (data.procedures || []).map((item, index) => (
      '<tr>'+
        '<td style="text-align:center;border:1px solid #000;padding:3px">'+(index+1)+'</td>'+
        '<td style="border:1px solid #000;padding:3px">'+(item.drug||'Item')+'</td>'+
        '<td style="text-align:center;border:1px solid #000;padding:3px">'+(item.quantity||0)+'</td>'+
        '<td style="text-align:right;border:1px solid #000;padding:3px">Rs '+((item.amount||0)*(item.quantity||0))+'</td>'+
      '</tr>'
    )).join('');

    const receivedVal = Math.max(0, Number(data.receivedAmount || 0));
    const receivableVal = Math.max(0, Number(data.grandTotal || 0) - receivedVal);

    const headerHTML = '<div style="text-align:center;margin-bottom:6px">' +
      '<div style="font-size:14px">'+ name +'</div>' +
      '<div style="font-size:11px">'+ addr +'</div>' +
      '<div style="font-size:11px">Phone: '+ phone +'</div>' +
    '</div>';

    const totalsTableHTML = (
      '<table>'+
        '<tr><td style="border:1px solid #000;padding:3px">Total</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ Number(data.subtotal||0).toLocaleString() +'</td></tr>'+
        (data.discount > 0 ? '<tr><td style="border:1px solid #000;padding:3px">Discount '+(data.discountType === '%' ? '('+data.discountValue+'%)' : '')+'</td><td style="border:1px solid #000;padding:3px;text-align:right">- Rs '+ Number(data.discount||0).toLocaleString() +'</td></tr>' : '') +
        '<tr><td style="border:1px solid #000;padding:3px">Prev. Dues</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ Number(data.previousDues||0).toLocaleString() +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">G.Total</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ Number(data.grandTotal||0).toLocaleString() +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Received</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ receivedVal.toLocaleString() +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Receivable</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ receivableVal.toLocaleString() +'</td></tr>'+
      '</table>'
    );

    const detailsTableHTML = (
      '<table>'+
        '<tr><td style="border:1px solid #000;padding:3px">Patient ID</td><td style="border:1px solid #000;padding:3px">'+ (data.petId||'N/A') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Client ID</td><td style="border:1px solid #000;padding:3px">'+ (data.clientId||'N/A') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Owner</td><td style="border:1px solid #000;padding:3px">'+ (data.ownerName||'') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Pet</td><td style="border:1px solid #000;padding:3px">'+ (data.petName||'') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Contact</td><td style="border:1px solid #000;padding:3px">'+ (data.contact||'') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Date</td><td style="border:1px solid #000;padding:3px">'+ new Date().toLocaleDateString() +'</td></tr>'+
      '</table>'
    );

    const html = (
      '<!doctype html><html><head><meta charset="utf-8" />'+
      '<title>Receipt</title>'+ 
      '<style>'+ 
      '@page{size:80mm auto;margin:2mm}'+
      'body{font-family:monospace;font-size:12px;margin:0;padding:2mm;color:#000;background:#fff;width:80mm;max-width:80mm;font-weight:bold}'+
      'table{width:100%;border-collapse:collapse;margin:5px 0}'+
      'th,td{border:1px solid #000;padding:3px}'+
      'th{text-align:center}'+
      '.title{background:#000;color:#fff;text-align:center;padding:4px 0;margin:6px 0}'+
      '</style></head><body>'+ 
      headerHTML+
      '<div class="title">PROCEDURES RECEIPT</div>'+ 
      detailsTableHTML+
      '<table><tr><th>S#</th><th>Procedure</th><th>Qty</th><th>Amount</th></tr>'+itemsHTML+'</table>'+ 
      totalsTableHTML+
      '<div style="text-align:center;margin-top:10px;border-top:1px dashed #000;padding-top:8px">'+
        '<div>Thank you!</div>'+ 
        '<div>Powered by MindSpire</div>'+ 
      '</div>'+ 
      '</body></html>'
    );
    return html;
  };

  const printThermalReceipt = (data) => {
    try {
      const html = buildReceiptHTML(data);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
      iframe.onload = () => {
        try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch {}
        setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 200);
      };
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FiClipboard className="text-emerald-600" /> Procedure Patients
          </h1>
          <p className="text-slate-600 text-sm">Manage procedure patients with details and dues tracking.</p>
        </div>
        <button
          onClick={() => {
            setEditingRecordId(null);
            setPetId('');
            setPetDetails({ petName: '', ownerName: '', contact: '', clientId: '' });
            setRows([{ mainCategory: '', subCategory: '', drug: '', quantity: 1, unit: '', amount: 0 }]);
            setSubtotal(0);
            setReceivedAmount(0);
            setPreviousDues(0);
            setShowDialog(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium shadow hover:bg-emerald-700"
        >
          <FiPlus />
          Add Procedure
        </button>
      </div>

      {showDialog && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FiPlus className="text-emerald-600" /> {editingRecordId ? 'Edit Procedure' : 'Add Procedure'}
              </h2>
              <button onClick={() => { setShowDialog(false); setEditingRecordId(null); }} className="text-slate-500 hover:text-slate-700">
                <FiX />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Patient info */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Pet ID</label>
                  <input
                    type="text"
                    value={petId}
                    onChange={(e) => handlePetIdChange(e.target.value)}
                    placeholder="Search Pet ID"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Pet Name</label>
                  <input
                    type="text"
                    value={petDetails.petName}
                    onChange={(e) => handlePetFieldChange('petName', e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Owner Name</label>
                  <input
                    type="text"
                    value={petDetails.ownerName}
                    onChange={(e) => handlePetFieldChange('ownerName', e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Client ID</label>
                  <input
                    type="text"
                    value={petDetails.clientId}
                    onChange={(e) => handlePetFieldChange('clientId', e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Contact</label>
                  <input
                    type="text"
                    value={petDetails.contact}
                    onChange={(e) => handlePetFieldChange('contact', e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </div>

              {/* Procedures table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Main Cat</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Sub Cat</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Drug</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Qty</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Unit</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Amount</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const rowSubCategories = unique(
                        catalog.filter((r) => !row.mainCategory || r.mainCategory === row.mainCategory).map((r) => r.subCategory)
                      );
                      const rowDrugs = catalog.filter(
                        (r) => (!row.mainCategory || r.mainCategory === row.mainCategory) && (!row.subCategory || r.subCategory === row.subCategory)
                      );
                      return (
                        <tr key={idx} className="border-t border-slate-100">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <select
                                value={row.mainCategory}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (v === '__manage_catalog__') { openManageCatalog(); return }
                                  updateRow(idx, { mainCategory: v })
                                }}
                                className="w-full h-9 px-2 rounded-lg border border-slate-300 text-xs"
                              >
                                <option value="">Select</option>
                                {mainCategories.map((mc) => (
                                  <option key={mc} value={mc}>
                                    {mc}
                                  </option>
                                ))}
                                <option value="__manage_catalog__">Manage</option>
                              </select>
                              <button type="button" onClick={() => openNewItem(idx)} className="text-emerald-600 text-xs hover:underline whitespace-nowrap">+ New</button>
                              <button type="button" onClick={() => openManageCatalog()} className="text-indigo-600 text-xs hover:underline whitespace-nowrap">Manage</button>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={row.subCategory}
                              onChange={(e) => {
                                const v = e.target.value
                                if (v === '__manage_catalog__') { openManageCatalog(); return }
                                updateRow(idx, { subCategory: v })
                              }}
                              className="w-full h-9 px-2 rounded-lg border border-slate-300 text-xs"
                            >
                              <option value="">Select</option>
                              {rowSubCategories.map((sc) => (
                                <option key={sc} value={sc}>
                                  {sc}
                                </option>
                              ))}
                              <option value="__manage_catalog__">Manage</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={row.drug}
                              onChange={(e) => {
                                const v = e.target.value
                                if (v === '__manage_catalog__') { openManageCatalog(); return }
                                updateRow(idx, { drug: v })
                              }}
                              className="w-full h-9 px-2 rounded-lg border border-slate-300 text-xs"
                            >
                              <option value="">Select</option>
                              {rowDrugs.map((d) => (
                                <option key={d.drug} value={d.drug}>
                                  {d.drug}
                                </option>
                              ))}
                              <option value="__manage_catalog__">Manage</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={row.quantity}
                              onChange={(e) => updateRow(idx, { quantity: Number(e.target.value || 0) })}
                              className="w-16 h-9 px-2 rounded-lg border border-slate-300 text-xs text-center"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="text"
                              value={row.unit}
                              onChange={(e) => updateRow(idx, { unit: e.target.value })}
                              className="w-20 h-9 px-2 rounded-lg border border-slate-300 text-xs text-center"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              value={row.amount}
                              onChange={(e) => updateRow(idx, { amount: Number(e.target.value || 0) })}
                              className="w-24 h-9 px-2 rounded-lg border border-slate-300 text-xs text-right"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeRow(idx)}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                  <button
                    type="button"
                    onClick={addRow}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 hover:bg-white"
                  >
                    <FiPlus className="w-3 h-3" /> Add Row
                  </button>
                  <div className="text-sm font-semibold text-slate-700">
                    Subtotal: Rs {subtotal.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="md:col-span-1 text-sm text-slate-600"></div>
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2 text-sm w-full">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>Rs {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Discount</span>
                    <div className="flex gap-1 items-center flex-wrap justify-end">
                      <input
                        type="number"
                        min="0"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(Number(e.target.value || 0))}
                        className="w-24 sm:w-28 h-8 px-2 rounded-lg border border-slate-300 text-right text-xs bg-white"
                      />
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value)}
                        className="w-20 sm:w-24 h-8 px-1 rounded-lg border border-slate-300 text-center text-xs bg-white"
                      >
                        <option value="PKR">PKR</option>
                        <option value="%">%</option>
                      </select>
                    </div>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Discount {discountType === '%' ? `(${discountValue}%)` : ''}</span>
                      <span>- Rs {discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-amber-700">
                    <span>Prev. Dues</span>
                    <span>Rs {previousDues.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-slate-200 pt-2 mt-1">
                    <span>Grand Total</span>
                    <span>Rs {grandTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Received Today</span>
                    <input
                      type="number"
                      min="0"
                      value={receivedAmount}
                      onChange={(e) => setReceivedAmount(Number(e.target.value || 0))}
                      className="w-28 sm:w-36 md:w-40 h-8 px-2 rounded-lg border border-slate-300 text-right text-xs bg-white"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Method</span>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-28 sm:w-36 md:w-40 h-8 px-2 rounded-lg border border-slate-300 text-right text-xs bg-white"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank">Bank/Card</option>
                      <option value="Online">Online</option>
                    </select>
                  </div>
                  <div className="flex justify-between">
                    <span>Receivable (incl. previous)</span>
                    <span>Rs {receivable.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
                  onClick={() => { setShowDialog(false); setEditingRecordId(null); }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSubmit(false)}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSubmit(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm disabled:opacity-60"
                >
                  <FiPrinter className="w-4 h-4" /> Save & Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {manageCatalogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-[95%] max-w-5xl max-h-[90vh] overflow-y-auto p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Manage Procedure Catalog</div>
              <button onClick={closeManageCatalog} className="text-slate-500 hover:text-slate-700"><FiX /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
              <input value={manageCatalogNew.mainCategory} onChange={(e)=>setManageCatalogNew(v=>({ ...v, mainCategory: e.target.value }))} placeholder="Main Category" className="h-10 px-3 rounded-lg border border-slate-300 text-sm md:col-span-1" />
              <input value={manageCatalogNew.subCategory} onChange={(e)=>setManageCatalogNew(v=>({ ...v, subCategory: e.target.value }))} placeholder="Sub Category" className="h-10 px-3 rounded-lg border border-slate-300 text-sm md:col-span-1" />
              <input value={manageCatalogNew.drug} onChange={(e)=>setManageCatalogNew(v=>({ ...v, drug: e.target.value }))} placeholder="Drug / Procedure" className="h-10 px-3 rounded-lg border border-slate-300 text-sm md:col-span-2" />
              <input value={manageCatalogNew.unit} onChange={(e)=>setManageCatalogNew(v=>({ ...v, unit: e.target.value }))} placeholder="Unit" className="h-10 px-3 rounded-lg border border-slate-300 text-sm md:col-span-1" />
              <div className="flex items-center gap-2 md:col-span-1">
                <button type="button" onClick={addManageCatalogItem} className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm">Add</button>
              </div>
              <input type="number" min="1" value={manageCatalogNew.defaultQuantity} onChange={(e)=>setManageCatalogNew(v=>({ ...v, defaultQuantity: Number(e.target.value||1) }))} placeholder="Default Qty" className="h-10 px-3 rounded-lg border border-slate-300 text-sm md:col-span-1" />
              <input type="number" min="0" value={manageCatalogNew.defaultAmount} onChange={(e)=>setManageCatalogNew(v=>({ ...v, defaultAmount: Number(e.target.value||0) }))} placeholder="Default Amount" className="h-10 px-3 rounded-lg border border-slate-300 text-sm md:col-span-2" />
            </div>

            {manageCatalogError && (
              <div className="mt-3 text-sm text-red-600">{manageCatalogError}</div>
            )}

            <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[980px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Main</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Sub</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Drug</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Unit</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Amount</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {manageCatalogItems.map((it, idx) => (
                    <tr key={it._id || idx} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <input value={it.mainCategory} onChange={(e)=>setManageCatalogField(idx,'mainCategory', e.target.value)} className="w-full h-9 px-2 rounded border border-slate-300 text-xs" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={it.subCategory} onChange={(e)=>setManageCatalogField(idx,'subCategory', e.target.value)} className="w-full h-9 px-2 rounded border border-slate-300 text-xs" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={it.drug} onChange={(e)=>setManageCatalogField(idx,'drug', e.target.value)} className="w-full h-9 px-2 rounded border border-slate-300 text-xs" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={it.unit} onChange={(e)=>setManageCatalogField(idx,'unit', e.target.value)} className="w-full h-9 px-2 rounded border border-slate-300 text-xs" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" min="1" value={it.defaultQuantity} onChange={(e)=>setManageCatalogField(idx,'defaultQuantity', Number(e.target.value||1))} className="w-20 h-9 px-2 rounded border border-slate-300 text-xs text-right" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" min="0" value={it.defaultAmount} onChange={(e)=>setManageCatalogField(idx,'defaultAmount', Number(e.target.value||0))} className="w-24 h-9 px-2 rounded border border-slate-300 text-xs text-right" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={()=>removeManageCatalogItem(idx)} className="h-9 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {manageCatalogItems.length === 0 && (
                    <tr><td colSpan="7" className="px-3 py-6 text-center text-slate-500">No items</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={closeManageCatalog} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700">Cancel</button>
              <button type="button" disabled={manageCatalogSaving} onClick={saveManageCatalog} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:opacity-60">{manageCatalogSaving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {showNewItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-[500px] max-w-full p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Add New Procedure Item</div>
              <button onClick={() => setShowNewItemModal(false)} className="text-slate-500 hover:text-slate-700"><FiX /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-1">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Main Category</label>
                <input list="mc-list" type="text" value={newItem.mainCategory} onChange={(e)=>setNewItem(v=>({...v, mainCategory:e.target.value}))} className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm" />
                <datalist id="mc-list">
                  {mainCategories.map(mc=> (<option key={mc} value={mc} />))}
                </datalist>
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Sub Category</label>
                <input list="sc-list" type="text" value={newItem.subCategory} onChange={(e)=>setNewItem(v=>({...v, subCategory:e.target.value}))} className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm" />
                <datalist id="sc-list">
                  {unique(catalog.filter(r=>!newItem.mainCategory || r.mainCategory===newItem.mainCategory).map(r=>r.subCategory)).map(sc => (<option key={sc} value={sc} />))}
                </datalist>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Drug / Procedure</label>
                <input type="text" value={newItem.drug} onChange={(e)=>setNewItem(v=>({...v, drug:e.target.value}))} className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Unit</label>
                <input type="text" value={newItem.unit} onChange={(e)=>setNewItem(v=>({...v, unit:e.target.value}))} className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Default Qty</label>
                <input type="number" min="1" value={newItem.defaultQuantity} onChange={(e)=>setNewItem(v=>({...v, defaultQuantity:Number(e.target.value||1)}))} className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Default Amount</label>
                <input type="number" min="0" value={newItem.defaultAmount} onChange={(e)=>setNewItem(v=>({...v, defaultAmount:Number(e.target.value||0)}))} className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={()=>setShowNewItemModal(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700">Cancel</button>
              <button disabled={creatingItem} onClick={saveNewItem} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:opacity-60">{creatingItem ? 'Saving...' : 'Save Item'}</button>
            </div>
          </div>
        </div>
      )}

      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-[400px] max-w-full p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Receipt Preview</div>
              <button onClick={() => setShowReceiptModal(false)} className="text-slate-500 hover:text-slate-700"><FiX /></button>
            </div>
            <div className="border border-slate-300 p-2 overflow-auto max-h-[70vh]">
              <iframe title="receipt-preview" className="w-full h-[60vh]" srcDoc={buildReceiptHTML(receiptData || {})} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => { try { if (receiptData) printThermalReceipt(receiptData) } catch {} ; setShowReceiptModal(false); }} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm"><FiPrinter className="inline mr-1"/> Print</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print layout (kept for fallback) */}
      <div ref={printRef} className="hidden print:block bg-white p-8 text-sm">
        <h2 className="text-xl font-bold mb-4">Procedure Sheet</h2>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div>
            <div><span className="font-semibold">Pet:</span> {petDetails.petName}</div>
            <div><span className="font-semibold">Owner:</span> {petDetails.ownerName} <span className="ml-2">({petDetails.clientId})</span></div>
          </div>
          <div>
            <div><span className="font-semibold">Contact:</span> {petDetails.contact}</div>
            <div><span className="font-semibold">Date:</span> {new Date().toLocaleDateString()}</div>
          </div>
        </div>
        <table className="w-full border border-slate-300 text-xs">
          <thead className="bg-slate-100">
            <tr>
              <th className="border border-slate-300 px-2 py-1 text-left">Main Cat</th>
              <th className="border border-slate-300 px-2 py-1 text-left">Sub Cat</th>
              <th className="border border-slate-300 px-2 py-1 text-left">Drug</th>
              <th className="border border-slate-300 px-2 py-1 text-center">QTY</th>
              <th className="border border-slate-300 px-2 py-1 text-center">Unit</th>
              <th className="border border-slate-300 px-2 py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx}>
                <td className="border border-slate-300 px-2 py-1">{r.mainCategory}</td>
                <td className="border border-slate-300 px-2 py-1">{r.subCategory}</td>
                <td className="border border-slate-300 px-2 py-1">{r.drug}</td>
                <td className="border border-slate-300 px-2 py-1 text-center">{r.quantity}</td>
                <td className="border border-slate-300 px-2 py-1 text-center">{r.unit}</td>
                <td className="border border-slate-300 px-2 py-1 text-right">{(r.amount * r.quantity).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 max-w-sm ml-auto space-y-1">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>Rs {subtotal.toLocaleString()}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Discount {discountType === '%' ? `(${discountValue}%)` : ''}</span>
              <span>- Rs {discountAmount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Prev. Dues</span>
            <span>Rs {previousDues.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-slate-300 pt-1 mt-1">
            <span>Grand Total</span>
            <span>Rs {grandTotal.toLocaleString()}</span>
          </div>
          <div className="mt-4 text-center text-xs text-slate-500 border-t border-slate-300 pt-2">
            <div>Thank you!</div>
            <div>Powered by MindSpire</div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-[400px] max-w-full p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-lg">Confirm Delete</div>
              <button onClick={() => { setShowDeleteConfirm(false); setRecordToDelete(null); }} className="text-slate-500 hover:text-slate-700">
                <FiX />
              </button>
            </div>
            <p className="text-slate-600 mb-4">
              Are you sure you want to delete this procedure record for <strong>{recordToDelete?.petName}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setRecordToDelete(null); }}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-medium">From</div>
          <input type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} className="h-9 px-2 rounded-lg border border-slate-300 text-sm" />
          <div className="text-sm font-medium">To</div>
          <input type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} className="h-9 px-2 rounded-lg border border-slate-300 text-sm" />
        </div>
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Date</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Pet ID</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Owner</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Procedure</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Billed</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Method</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Paid</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Due</th>
                <th className="px-3 py-2 text-center text-xs font-bold text-slate-600">Status</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => (
                <tr key={r._id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{new Date(r.createdAt || Date.now()).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{r.petId}</td>
                  <td className="px-3 py-2">
                    {r.ownerName}
                    <div className="text-[10px] text-slate-500">({r.clientId})</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-xs font-medium text-slate-800 truncate max-w-[150px]" title={r.procedures?.[0]?.drug || 'Procedure'}>
                      {r.procedures?.[0]?.drug || 'Procedure'}
                      {r.procedures?.length > 1 ? ` (+${r.procedures.length - 1})` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{Number(r.grandTotal || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-center">{r.paymentMethod || 'Cash'}</td>
                  <td className="px-3 py-2 text-right text-emerald-600 font-semibold">{Number(r.receivedAmount || 0).toLocaleString()}</td>
                  <td className={`px-3 py-2 text-right font-bold ${Number(r.receivable || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    Rs {Number(r.receivable || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      r.status === 'ongoing' 
                        ? 'bg-yellow-400 text-yellow-900 shadow-sm' 
                        : 'bg-emerald-500 text-white shadow-sm'
                    }`}>
                      {r.status === 'ongoing' ? 'In-Progress' : 'Completed'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2 text-xs">
                      <button 
                        onClick={() => { setReceiptData(r); setShowReceiptModal(true); }} 
                        className="h-8 w-8 rounded-lg border border-slate-200 text-indigo-600 hover:bg-indigo-50 inline-flex items-center justify-center transition-colors"
                        title="View"
                      >
                        <FiEye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { try { printThermalReceipt(r) } catch {} }} 
                        className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center transition-colors"
                        title="Reprint"
                      >
                        <FiPrinter className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEdit(r)} 
                        className="h-8 w-8 rounded-lg border border-slate-200 text-amber-600 hover:bg-amber-50 inline-flex items-center justify-center transition-colors"
                        title="Edit"
                      >
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { setRecordToDelete(r); setShowDeleteConfirm(true); }} 
                        className="h-8 w-8 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50 inline-flex items-center justify-center transition-colors"
                        title="Delete"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-3 py-6 text-center text-slate-500 text-sm">
                    No records
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-[9999] text-sm font-semibold">
          {toast}
        </div>
      )}
    </div>
  );
}
