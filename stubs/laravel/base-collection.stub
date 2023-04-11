<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\ResourceCollection;

class BaseCollection extends ResourceCollection
{
    protected $classResource;

    public function __construct($data, $classResource)
    {
        parent::__construct($data);
        $this->classResource = $classResource;
    }

    public function toArray($request)
    {
        return [
            'items' => $this->classResource::collection($this->collection),
            'links' => [
                'first_page' => $this->url(1),
                'last_page' => $this->url($this->lastPage()),
                'prev' => $this->previousPageUrl(),
                'next' => $this->nextPageUrl(),
            ],
            'meta' => [
                'current_page' => $this->currentPage(),
                'item_per_page' =>  (int) $this->perPage(),
                'last_page' => $this->lastPage(),
                'total' => $this->total(),
                'count' => $this->count(),
            ],
        ];
    }
}
