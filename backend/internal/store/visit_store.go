package store

type Visit struct {
}

type VisitStore interface {
	CreateVisit(*Visit) error
	GetVisitByID(id string) (*Visit, error)
	ListVisits(limit, offset int) ([]*Visit, error)
	UpdateVisitStatus(id, status string) error
}
